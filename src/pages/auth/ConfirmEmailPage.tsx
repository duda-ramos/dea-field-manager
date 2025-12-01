import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ConfirmEmailPage = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando email...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        console.log('🔍 [ConfirmEmail] Iniciando verificação de confirmação de email');
        
        // O Supabase detecta automaticamente o token na URL
        const { data, error } = await supabase.auth.getSession();
        
        console.log('📧 [ConfirmEmail] Sessão obtida:', { 
          hasSession: !!data.session, 
          error: error?.message 
        });

        if (error) {
          console.error('❌ [ConfirmEmail] Erro ao confirmar email:', error);
          setStatus('error');
          setMessage('Erro ao confirmar email: ' + error.message);
          return;
        }

        if (data.session) {
          console.log('✅ [ConfirmEmail] Email confirmado com sucesso!');
          setStatus('success');
          setMessage('Email confirmado com sucesso! Redirecionando...');
          setTimeout(() => {
            console.log('🔀 [ConfirmEmail] Redirecionando para dashboard');
            navigate('/');
          }, 2000);
        } else {
          console.warn('⚠️ [ConfirmEmail] Nenhuma sessão encontrada');
          setStatus('error');
          setMessage('Não foi possível confirmar o email. O link pode ter expirado.');
        }
      } catch (error) {
        console.error('💥 [ConfirmEmail] Erro inesperado:', error);
        setStatus('error');
        setMessage('Erro inesperado ao confirmar email.');
      }
    };

    handleEmailConfirmation();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Confirmação de Email</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center text-green-600 font-medium">{message}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-center text-red-600">{message}</p>
              <Button 
                onClick={() => navigate('/auth/login')}
                variant="outline"
                className="mt-4"
              >
                Voltar para login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
