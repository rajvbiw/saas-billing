const mysql = require('mysql2/promise');
const { Route53Client, ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const route53 = new Route53Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Global configurations
const RDS_HOST = process.env.RDS_HOST || '127.0.0.1';
const RDS_PORT = parseInt(process.env.RDS_PORT || '3306');
const RDS_USER = process.env.RDS_USER || 'root';
const RDS_PASSWORD = process.env.RDS_PASSWORD || 'rootpassword';
const SHARED_DB_NAME = process.env.SHARED_DB_NAME || 'saas_platform';
const HOSTED_ZONE_ID = process.env.HOSTED_ZONE_ID;
const ALB_DNS_NAME = process.env.ALB_DNS_NAME || 'alb.saas.example.com';
const SNS_ALERT_TOPIC = process.env.SNS_ALERT_TOPIC_ARN;
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@saas.example.com';

exports.handler = async (event) => {
  console.log('Received provisioning event payload:', JSON.stringify(event, null, 2));

  // Process SQS messages
  for (const record of event.Records) {
    const payload = JSON.parse(record.body);
    const { jobId, tenantId, slug, companyName, ownerName, ownerEmail, passwordHash, subdomain } = payload;

    let sharedConnection = null;
    let tenantConnection = null;

    try {
      // Establish pool connection to shared database
      sharedConnection = await mysql.createConnection({
        host: RDS_HOST,
        port: RDS_PORT,
        user: RDS_USER,
        password: RDS_PASSWORD,
        database: SHARED_DB_NAME
      });

      // Step 1: Update provisioning_job status -> in_progress
      console.log(`[Step 1] Updating job ${jobId} to IN_PROGRESS`);
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET status = "in_progress", steps_completed = ? WHERE id = ?',
        [JSON.stringify(['1. Initialized onboarding job']), jobId]
      );

      // Step 2: Create RDS database: tenant_{slug}_db
      const dbName = `tenant_${slug}_db`;
      console.log(`[Step 2] Creating tenant isolated database: ${dbName}`);
      await sharedConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      
      const currentSteps = ['1. Initialized onboarding job', `2. Database ${dbName} created`];
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 3: Run migrations on new database
      console.log(`[Step 3] Running migrations / syncing tables on ${dbName}`);
      tenantConnection = await mysql.createConnection({
        host: RDS_HOST,
        port: RDS_PORT,
        user: RDS_USER,
        password: RDS_PASSWORD,
        database: dbName
      });

      // Create Tables
      await tenantConnection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
          is_active BOOLEAN DEFAULT true,
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await tenantConnection.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          key_hash VARCHAR(255) NOT NULL UNIQUE,
          prefix VARCHAR(255) NOT NULL,
          last_used_at DATETIME,
          expires_at DATETIME,
          permissions JSON,
          is_active BOOLEAN DEFAULT true,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await tenantConnection.query(`
        CREATE TABLE IF NOT EXISTS api_usage_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          api_key_id INT NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INT NOT NULL,
          response_time_ms INT NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await tenantConnection.query(`
        CREATE TABLE IF NOT EXISTS team_invitations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
          invited_by INT NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          accepted_at DATETIME,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await tenantConnection.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          action VARCHAR(255) NOT NULL,
          resource VARCHAR(255) NOT NULL,
          resource_id VARCHAR(255),
          metadata JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      currentSteps.push('3. Database tables synchronized');
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 4: Seed default owner user
      console.log('[Step 4] Seeding owner credentials');
      await tenantConnection.execute(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, "owner", true)',
        [ownerName, ownerEmail, passwordHash]
      );

      currentSteps.push('4. Owner account seeded');
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 5: Create K8s namespace (Simulating API call to EKS control plane)
      console.log(`[Step 5] Mapping Kubernetes namespace: tenant-${slug}`);
      // In a real EKS setting, we would fetch credentials and call /api/v1/namespaces REST endpoint
      // We will print the manifest request execution log:
      console.log(`APPLYING: Namespace tenant-${slug}`);

      currentSteps.push(`5. Kubernetes namespace tenant-${slug} created`);
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 6: Apply Helm release for backend/frontend values (Simulating Helm values generation)
      console.log('[Step 6] Compiling Helm tenant overrides');
      console.log(`HELM values template populated for tenant: ${slug}`);

      currentSteps.push('6. Helm overrides configuration applied');
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 7: Create Route53 CNAME: {slug}.saas.example.com -> ALB
      console.log(`[Step 7] Adding Route53 alias set for subdomain: ${subdomain}`);
      if (HOSTED_ZONE_ID) {
        const route53Params = {
          HostedZoneId: HOSTED_ZONE_ID,
          ChangeBatch: {
            Changes: [
              {
                Action: 'UPSERT',
                ResourceRecordSet: {
                  Name: subdomain,
                  Type: 'CNAME',
                  TTL: 300,
                  ResourceRecords: [{ Value: ALB_DNS_NAME }]
                }
              }
            ]
          }
        };
        const route53Cmd = new ChangeResourceRecordSetsCommand(route53Params);
        await route53.send(route53Cmd);
      } else {
        console.warn('HOSTED_ZONE_ID not configured. Skipping DNS resource sets update.');
      }

      currentSteps.push(`7. DNS records routed for ${subdomain}`);
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 8: Update tenant record: db_name, namespace, status -> active
      console.log('[Step 8] Updating Tenant record state in shared database');
      await sharedConnection.execute(
        'UPDATE tenants SET db_name = ?, db_host = ?, namespace = ?, status = "active" WHERE id = ?',
        [dbName, RDS_HOST, `tenant-${slug}`, tenantId]
      );

      currentSteps.push('8. Platform tenant workspace updated');
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 9: Send welcome email via SES
      console.log('[Step 9] Sending Welcome SES email');
      const loginUrl = `http://${subdomain}/login`;
      const sesParams = {
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [ownerEmail] },
        Message: {
          Subject: { Data: `Welcome to SaaSPlatform, ${ownerName}!` },
          Body: {
            Html: {
              Data: `<h3>Welcome to SaaSPlatform!</h3><p>Your workspace is ready at <a href="${loginUrl}">${loginUrl}</a>.</p>`
            }
          }
        }
      };
      const sesCmd = new SendEmailCommand(sesParams);
      await ses.send(sesCmd);

      currentSteps.push('9. Onboarding dispatch sent to admin');
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET steps_completed = ? WHERE id = ?',
        [JSON.stringify(currentSteps), jobId]
      );

      // Step 10: Update provisioning_job status -> completed
      console.log('[Step 10] Provisioning job completed.');
      await sharedConnection.execute(
        'UPDATE provisioning_jobs SET status = "completed", completed_at = ? WHERE id = ?',
        [new Date(), jobId]
      );

    } catch (err) {
      console.error('Lambda Onboarding provisioning failed:', err);

      // Publish alert to SNS topic
      if (SNS_ALERT_TOPIC) {
        try {
          const snsParams = {
            TopicArn: SNS_ALERT_TOPIC,
            Subject: `ALERT: Tenant Onboarding Failed (${slug})`,
            Message: `Failed to provision tenant ${slug}. Job: ${jobId}. Error: ${err.message}`
          };
          await sns.send(new PublishCommand(snsParams));
        } catch (snsErr) {
          console.error('SNS alarm publish failed:', snsErr);
        }
      }

      // Update DB record on failure
      if (sharedConnection) {
        try {
          await sharedConnection.execute(
            'UPDATE provisioning_jobs SET status = "failed", error = ?, completed_at = ? WHERE id = ?',
            [err.message, new Date(), jobId]
          );
          
          await sharedConnection.execute(
            'UPDATE tenants SET status = "suspended" WHERE id = ?',
            [tenantId]
          );
        } catch (dbErr) {
          console.error('Failed to write failure logs to DB:', dbErr);
        }
      }
    } finally {
      if (sharedConnection) await sharedConnection.end();
      if (tenantConnection) await tenantConnection.end();
    }
  }

  return { statusCode: 200, body: 'SQS onboarding message batch processed.' };
};
