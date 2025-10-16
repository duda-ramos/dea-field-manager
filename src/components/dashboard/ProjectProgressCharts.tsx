import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/services/logger';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { Project } from '@/types';
import { LoadingState } from '@/components/ui/loading-spinner';

interface ChartData {
  name: string;
  projetos: number;
  concluidos: number;
  emAndamento: number;
  planejamento: number;
  valor?: number;
  data?: string;
}

interface ProjectProgressChartsProps {
  projects: Project[];
  className?: string;
}

export function ProjectProgressCharts({ projects, className }: ProjectProgressChartsProps) {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | '1y' | 'all'>('6m');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [statusData, setStatusData] = useState<ChartData[]>([]);

  useEffect(() => {
    generateChartData();
  }, [projects, timeframe]);

  const generateChartData = async () => {
    try {
      setLoading(true);
      
      // Generate monthly data based on project creation dates
      const now = new Date();
      const months = timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : timeframe === '1y' ? 12 : 24;
      
      const monthlyData: ChartData[] = [];
      
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        // Filter projects created up to this month
        const projectsUpToMonth = projects.filter(p => {
          const projectDate = new Date(p.created_at);
          return projectDate <= new Date(date.getFullYear(), date.getMonth() + 1, 0);
        });
        
        const statusCounts = {
          completed: projectsUpToMonth.filter(p => p.status === 'completed').length,
          inProgress: projectsUpToMonth.filter(p => p.status === 'in-progress').length,
          planning: projectsUpToMonth.filter(p => p.status === 'planning').length
        };

        monthlyData.push({
          name: monthName,
          projetos: projectsUpToMonth.length,
          concluidos: statusCounts.completed,
          emAndamento: statusCounts.inProgress,
          planejamento: statusCounts.planning,
          data: date.toISOString()
        });
      }

      setChartData(monthlyData);

      // Generate current status data for pie chart
      const currentStatusData = [
        {
          name: 'Concluídos',
          projetos: projects.filter(p => p.status === 'completed').length,
          concluidos: projects.filter(p => p.status === 'completed').length,
          emAndamento: 0,
          planejamento: 0
        },
        {
          name: 'Em Andamento',
          projetos: projects.filter(p => p.status === 'in-progress').length,
          concluidos: 0,
          emAndamento: projects.filter(p => p.status === 'in-progress').length,
          planejamento: 0
        },
        {
          name: 'Planejamento',
          projetos: projects.filter(p => p.status === 'planning').length,
          concluidos: 0,
          emAndamento: 0,
          planejamento: projects.filter(p => p.status === 'planning').length
        }
      ].filter(item => item.projetos > 0);

      setStatusData(currentStatusData);
    } catch (error) {
      console.error('[ProjectProgressCharts] Falha ao gerar dados dos gráficos:', error, {
        projectCount: projects?.length || 0,
        timeframe
      });
      logger.error('Error generating chart data', {
        error,
        projectCount: projects?.length || 0,
        operacao: 'generateChartData'
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    concluidos: '#22c55e',
    emAndamento: '#f59e0b', 
    planejamento: '#6b7280'
  };

  const pieColors = ['#22c55e', '#f59e0b', '#6b7280', '#3b82f6', '#8b5cf6'];

  const calculateTrend = () => {
    if (chartData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const latest = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    
    if (latest.projetos === previous.projetos) return { direction: 'stable', percentage: 0 };
    
    const percentage = ((latest.projetos - previous.projetos) / previous.projetos) * 100;
    return {
      direction: percentage > 0 ? 'up' : 'down',
      percentage: Math.abs(percentage)
    };
  };

  const trend = calculateTrend();

  if (loading) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="p-6">
            <LoadingState message="Carregando gráficos..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Progresso dos Projetos
              </CardTitle>
              <CardDescription>
                Acompanhe a evolução dos seus projetos ao longo do tempo
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Trend indicator */}
              {trend.direction !== 'stable' && (
                <div className="flex items-center gap-1">
                  {trend.direction === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`text-sm font-medium ${
                    trend.direction === 'up' ? 'text-success' : 'text-destructive'
                  }`}>
                    {trend.percentage.toFixed(1)}%
                  </span>
                </div>
              )}
              
              <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">3 meses</SelectItem>
                  <SelectItem value="6m">6 meses</SelectItem>
                  <SelectItem value="1y">1 ano</SelectItem>
                  <SelectItem value="all">Tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timeline" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="status" className="gap-2">
                <PieChartIcon className="h-4 w-4" />
                Status
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2">
                <Activity className="h-4 w-4" />
                Progresso
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Bar 
                      dataKey="projetos" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Total de Projetos"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="projetos"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Distribuição por Status</h4>
                  <div className="space-y-3">
                    {statusData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: pieColors[index % pieColors.length] }}
                          />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <Badge variant="secondary">
                          {item.projetos} projeto{item.projetos !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{projects.length}</div>
                      <div className="text-sm text-muted-foreground">Total de Projetos</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="progress" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="concluidos"
                      stackId="1"
                      stroke={statusColors.concluidos}
                      fill={statusColors.concluidos}
                      fillOpacity={0.6}
                      name="Concluídos"
                    />
                    <Area
                      type="monotone"
                      dataKey="emAndamento"
                      stackId="1"
                      stroke={statusColors.emAndamento}
                      fill={statusColors.emAndamento}
                      fillOpacity={0.6}
                      name="Em Andamento"
                    />
                    <Area
                      type="monotone"
                      dataKey="planejamento"
                      stackId="1"
                      stroke={statusColors.planejamento}
                      fill={statusColors.planejamento}
                      fillOpacity={0.6}
                      name="Planejamento"
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}