import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    const { error } = await resetPassword(email);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
      toast({
        title: 'Email enviado',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.'
      });
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Email Enviado</CardTitle>
            <CardDescription className="text-center">
              Verifique sua caixa de entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Enviamos um email para <strong>{email}</strong> com instruções para redefinir sua senha.
            </p>
            
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Esqueceu a Senha?</CardTitle>
          <CardDescription className="text-center">
            Digite seu email para receber instruções de redefinição
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !email}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Email
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/auth/login"
              className="text-sm text-muted-foreground hover:text-primary inline-flex items-center"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Voltar ao login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};