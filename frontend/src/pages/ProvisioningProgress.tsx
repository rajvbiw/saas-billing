import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Loader2, CheckCircle2, AlertTriangle, Cpu, Globe, Database, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export const ProvisioningProgress: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'failed'>('pending');
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Default expected steps for UI structure
  const expectedSteps = [
    'Creating database schemas',
    'Setting up schema tables',
    'Creating root account',
    'Configuring isolated Kubernetes namespace',
    'Injecting Helm values maps',
    'Configuring local virtual Route53 DNS records',
    'Finalizing tenant billing credentials',
    'Initiating status handshake',
    'Dispatching tenant notification dispatch',
    'Provisioning steps finalized'
  ];

  useEffect(() => {
    if (!tenantId) return;

    let intervalId: any;

    const checkStatus = async () => {
      try {
        const res = await api.get(`/onboarding/status/${tenantId}`);
        setStatus(res.data.status);
        setSteps(res.data.steps || []);
        
        if (res.data.status === 'completed') {
          clearInterval(intervalId);
          toast.success('Workspace environment is fully provisioned!');
          // Redirect to login page
          setTimeout(() => {
            navigate(`/login`);
          }, 2000);
        } else if (res.data.status === 'failed') {
          clearInterval(intervalId);
          setError(res.data.error || 'Infrastructure provisioning run failed.');
          toast.error('Provisioning failed. Please contact platform support.');
        }
      } catch (err: any) {
        console.error('Error polling provisioning status:', err);
      }
    };

    // Run immediately and poll every 1.5 seconds
    checkStatus();
    intervalId = setInterval(checkStatus, 1500);

    return () => clearInterval(intervalId);
  }, [tenantId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-xl w-full max-w-xl p-8 space-y-6">
        
        <div className="text-center space-y-2">
          {status === 'failed' ? (
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle size={32} />
            </div>
          ) : status === 'completed' ? (
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 animate-bounce">
              <CheckCircle2 size={32} />
            </div>
          ) : (
            <div className="mx-auto w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Loader2 size={32} className="animate-spin" />
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mt-4">
            {status === 'completed' 
              ? 'Workspace Ready' 
              : status === 'failed' 
                ? 'Provisioning Failed' 
                : 'Setting Up Your Workspace'}
          </h1>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {status === 'completed' 
              ? 'Redirecting to login portal...' 
              : status === 'failed' 
                ? 'An error occurred setting up isolated cloud resources.'
                : 'Our background Lambda coordinator is deploying EKS resources and seeding DB nodes.'}
          </p>
        </div>

        {/* Stepper Steps List */}
        <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-3">
          {expectedSteps.map((stepDesc, index) => {
            const isCompleted = steps.length > index;
            const isCurrent = steps.length === index && status !== 'completed' && status !== 'failed';

            return (
              <div 
                key={index} 
                className={`flex items-center justify-between text-xs py-1 transition-all ${
                  isCompleted 
                    ? 'text-gray-900 font-semibold' 
                    : isCurrent 
                      ? 'text-indigo-600 font-semibold' 
                      : 'text-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border font-bold text-[10px] ${
                    isCompleted 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : isCurrent 
                        ? 'border-indigo-500 text-indigo-500 bg-white animate-pulse' 
                        : 'border-gray-200 bg-white text-gray-400'
                  }`}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <span>{stepDesc}</span>
                </div>
                {isCurrent && <Loader2 size={12} className="animate-spin text-indigo-600" />}
              </div>
            );
          })}
        </div>

        {/* Error Block */}
        {status === 'failed' && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600 space-y-1">
            <span className="font-bold">Error logs:</span>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
