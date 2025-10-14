/**
 * Utilitário para testes de performance do sistema de revisões
 */

export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  /**
   * Marca o início de uma medição
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * Mede o tempo decorrido desde a marca
   */
  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`Mark "${startMark}" not found`);
      return 0;
    }

    const duration = performance.now() - start;
    
    // Armazena a medição
    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }
    this.measures.get(name)!.push(duration);

    return duration;
  }

  /**
   * Obtém estatísticas de uma medição
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
  } | null {
    const measures = this.measures.get(name);
    if (!measures || measures.length === 0) return null;

    const sorted = [...measures].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  /**
   * Limpa todas as medições
   */
  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }

  /**
   * Gera relatório de performance
   */
  generateReport(): string {
    const report: string[] = ['=== Performance Report ==='];
    
    this.measures.forEach((_, name) => {
      const stats = this.getStats(name);
      if (stats) {
        report.push(`\n${name}:`);
        report.push(`  Samples: ${stats.count}`);
        report.push(`  Min: ${stats.min.toFixed(2)}ms`);
        report.push(`  Max: ${stats.max.toFixed(2)}ms`);
        report.push(`  Avg: ${stats.avg.toFixed(2)}ms`);
        report.push(`  Median: ${stats.median.toFixed(2)}ms`);
      }
    });

    return report.join('\n');
  }
}

/**
 * Hook para monitorar performance de componentes
 */
export function usePerformanceMonitor() {
  const monitor = new PerformanceMonitor();

  return {
    mark: (name: string) => monitor.mark(name),
    measure: (name: string, startMark: string) => {
      const duration = monitor.measure(name, startMark);
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    },
    getStats: (name: string) => monitor.getStats(name),
    generateReport: () => monitor.generateReport(),
    clear: () => monitor.clear()
  };
}

/**
 * Testa performance de renderização
 */
export async function testRenderPerformance(
  componentName: string,
  renderFn: () => void,
  iterations: number = 10
): Promise<void> {
  const monitor = new PerformanceMonitor();

  console.log(`\n[Performance Test] ${componentName}`);
  console.log(`Running ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    monitor.mark(`render-${i}`);
    renderFn();
    monitor.measure('render-time', `render-${i}`);
    
    // Pequeno delay para permitir que o navegador processe
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const stats = monitor.getStats('render-time');
  if (stats) {
    console.log(`\nResults for ${componentName}:`);
    console.log(`  Average: ${stats.avg.toFixed(2)}ms`);
    console.log(`  Min: ${stats.min.toFixed(2)}ms`);
    console.log(`  Max: ${stats.max.toFixed(2)}ms`);
    console.log(`  Median: ${stats.median.toFixed(2)}ms`);
    
    // Alertas de performance
    if (stats.avg > 500) {
      console.warn('⚠️  Average render time exceeds 500ms threshold');
    } else if (stats.avg > 300) {
      console.warn('⚠️  Average render time exceeds 300ms (consider optimization)');
    } else {
      console.log('✅ Performance within acceptable range');
    }
  }
}

/**
 * Monitora memory leaks
 */
export class MemoryLeakDetector {
  private initialMemory: number = 0;
  private measurements: number[] = [];

  start(): void {
    if ('memory' in performance) {
      this.initialMemory = (performance as any).memory.usedJSHeapSize;
      this.measurements = [this.initialMemory];
    } else {
      console.warn('Performance.memory API not available');
    }
  }

  measure(): number {
    if ('memory' in performance) {
      const current = (performance as any).memory.usedJSHeapSize;
      this.measurements.push(current);
      return current;
    }
    return 0;
  }

  analyze(): {
    hasLeak: boolean;
    growth: number;
    growthPercentage: number;
  } {
    if (this.measurements.length < 2) {
      return { hasLeak: false, growth: 0, growthPercentage: 0 };
    }

    const finalMemory = this.measurements[this.measurements.length - 1];
    const growth = finalMemory - this.initialMemory;
    const growthPercentage = (growth / this.initialMemory) * 100;

    // Considera memory leak se o crescimento for > 10%
    const hasLeak = growthPercentage > 10;

    return { hasLeak, growth, growthPercentage };
  }

  report(): void {
    const analysis = this.analyze();
    console.log('\n=== Memory Leak Detection ===');
    console.log(`Initial memory: ${(this.initialMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Final memory: ${(this.measurements[this.measurements.length - 1] / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Growth: ${(analysis.growth / 1024 / 1024).toFixed(2)} MB (${analysis.growthPercentage.toFixed(2)}%)`);
    
    if (analysis.hasLeak) {
      console.warn('⚠️  Potential memory leak detected!');
    } else {
      console.log('✅ No significant memory leak detected');
    }
  }
}