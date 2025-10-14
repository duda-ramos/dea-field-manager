import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PerformanceMonitor, MemoryLeakDetector } from "@/utils/performance-test";
import { Activity, AlertTriangle, CheckCircle, Clock, Database, Zap } from "lucide-react";

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
  timestamp: number;
}

interface PerformanceTestPanelProps {
  componentName: string;
  onTest?: () => void;
}

export function PerformanceTestPanel({ componentName, onTest }: PerformanceTestPanelProps) {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [performanceMonitor] = useState(() => new PerformanceMonitor());
  const [memoryDetector] = useState(() => new MemoryLeakDetector());
  const [testResults, setTestResults] = useState<{
    avgRenderTime: number;
    maxRenderTime: number;
    memoryLeak: boolean;
    memoryGrowth: number;
  } | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      performanceMonitor.clear();
    };
  }, [performanceMonitor]);

  const runPerformanceTest = async () => {
    setIsTestRunning(true);
    setMetrics([]);
    setTestResults(null);
    
    performanceMonitor.clear();
    memoryDetector.start();

    const newMetrics: PerformanceMetrics[] = [];

    // Run 10 iterations
    for (let i = 0; i < 10; i++) {
      const startMark = `test-${i}`;
      performanceMonitor.mark(startMark);
      
      // Trigger test action
      if (onTest) {
        onTest();
      }

      // Measure render time
      const renderTime = performanceMonitor.measure('render-time', startMark);
      const memoryUsage = memoryDetector.measure();

      newMetrics.push({
        renderTime,
        memoryUsage,
        componentCount: document.querySelectorAll('[data-testid]').length,
        timestamp: Date.now()
      });

      // Wait between iterations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setMetrics(newMetrics);

    // Calculate results
    const stats = performanceMonitor.getStats('render-time');
    const memoryAnalysis = memoryDetector.analyze();

    if (stats) {
      setTestResults({
        avgRenderTime: stats.avg,
        maxRenderTime: stats.max,
        memoryLeak: memoryAnalysis.hasLeak,
        memoryGrowth: memoryAnalysis.growthPercentage
      });
    }

    setIsTestRunning(false);
  };

  const getPerformanceStatus = () => {
    if (!testResults) return null;

    if (testResults.avgRenderTime < 200) {
      return { status: "excellent", icon: CheckCircle, color: "text-green-600" };
    } else if (testResults.avgRenderTime < 500) {
      return { status: "good", icon: Zap, color: "text-blue-600" };
    } else {
      return { status: "needs-optimization", icon: AlertTriangle, color: "text-orange-600" };
    }
  };

  const performanceStatus = getPerformanceStatus();

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Performance Test Panel
        </CardTitle>
        <CardDescription>
          Testing component: {componentName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={runPerformanceTest} 
            disabled={isTestRunning}
            variant={isTestRunning ? "secondary" : "default"}
          >
            {isTestRunning ? "Running Test..." : "Run Performance Test"}
          </Button>
          
          {performanceStatus && (
            <Badge variant="outline" className="flex items-center gap-1">
              <performanceStatus.icon className={`h-4 w-4 ${performanceStatus.color}`} />
              {performanceStatus.status}
            </Badge>
          )}
        </div>

        {testResults && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Render Performance
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Average:</span>
                  <span className={`text-sm font-medium ${
                    testResults.avgRenderTime < 500 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {testResults.avgRenderTime.toFixed(2)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Max:</span>
                  <span className="text-sm">{testResults.maxRenderTime.toFixed(2)}ms</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                Memory Usage
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Growth:</span>
                  <span className={`text-sm font-medium ${
                    testResults.memoryGrowth < 10 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {testResults.memoryGrowth.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Leak Detected:</span>
                  <span className="text-sm">{testResults.memoryLeak ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {testResults && (
          <Alert variant={testResults.avgRenderTime > 500 || testResults.memoryLeak ? "destructive" : "default"}>
            <AlertDescription>
              {testResults.avgRenderTime > 500 && (
                <div>⚠️ Render time exceeds 500ms threshold. Consider optimizing component.</div>
              )}
              {testResults.memoryLeak && (
                <div>⚠️ Potential memory leak detected. Check event listeners and cleanup.</div>
              )}
              {testResults.avgRenderTime <= 500 && !testResults.memoryLeak && (
                <div>✅ Performance is within acceptable range.</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {metrics.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Test Iterations</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {metrics.map((metric, index) => (
                <div key={index} className="flex justify-between text-xs py-1 px-2 bg-muted/50 rounded">
                  <span>Iteration {index + 1}</span>
                  <span className={metric.renderTime > 500 ? 'text-orange-600' : ''}>
                    {metric.renderTime.toFixed(2)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}