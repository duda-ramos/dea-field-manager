/**
 * 🛠️ Debug Helpers para Testes Manuais de Sincronização
 * 
 * COMO USAR:
 * 1. Abra o DevTools Console (F12)
 * 2. Cole este arquivo inteiro e pressione Enter
 * 3. Use as funções abaixo para debugar
 */

// ===========================================
// FUNÇÕES PRINCIPAIS
// ===========================================

/**
 * 📊 Ver estado completo do sistema de sync
 */
window.debugSync = function() {
  const state = syncStateManager.getState();
  
  console.group('📊 Estado do Sistema de Sync');
  console.log('Status:', state.status);
  console.log('Online:', state.isOnline);
  console.log('Pendente (Push):', state.pendingPush);
  console.log('Por Tabela:', state.pendingByTable);
  console.log('Último Sync:', state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : 'Nunca');
  console.log('Último Erro:', state.lastError);
  console.log('Logs (últimos 5):', state.logs.slice(0, 5));
  console.groupEnd();
  
  return state;
};

/**
 * 🔢 Contar registros dirty no IndexedDB
 */
window.countDirty = async function() {
  const counts = {
    projects: await db.projects.where('_dirty').equals(1).count(),
    installations: await db.installations.where('_dirty').equals(1).count(),
    contacts: await db.contacts.where('_dirty').equals(1).count(),
    budgets: await db.budgets.where('_dirty').equals(1).count(),
    itemVersions: await db.itemVersions.where('_dirty').equals(1).count(),
    files: await db.files.where('_dirty').equals(1).count()
  };
  
  const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
  
  console.group('🔢 Registros Dirty no IndexedDB');
  console.log('Projects:', counts.projects);
  console.log('Installations:', counts.installations);
  console.log('Contacts:', counts.contacts);
  console.log('Budgets:', counts.budgets);
  console.log('Item Versions:', counts.itemVersions);
  console.log('Files:', counts.files);
  console.log('─────────────────');
  console.log('TOTAL:', total);
  console.groupEnd();
  
  return counts;
};

/**
 * 📋 Listar projetos dirty
 */
window.listDirtyProjects = async function() {
  const projects = await db.projects.where('_dirty').equals(1).toArray();
  
  console.group('📋 Projetos Dirty');
  projects.forEach(p => {
    console.log(`• ${p.name} (ID: ${p.id})`);
    console.log(`  _dirty: ${p._dirty}, _deleted: ${p._deleted}`);
    console.log(`  updatedAt: ${new Date(p.updatedAt).toLocaleString()}`);
  });
  console.groupEnd();
  
  return projects;
};

/**
 * 🕐 Ver timestamp do último pull
 */
window.getLastPull = async function() {
  const { getLastPulledAt } = await import('./services/sync/localFlags');
  const lastPull = await getLastPulledAt();
  
  console.group('🕐 Último Pull');
  console.log('Timestamp:', lastPull);
  console.log('Data:', new Date(lastPull).toLocaleString());
  console.log('Há quanto tempo:', Math.round((Date.now() - lastPull) / 1000), 'segundos atrás');
  console.groupEnd();
  
  return lastPull;
};

/**
 * 🔄 Forçar atualização do badge
 */
window.refreshBadge = async function() {
  console.log('🔄 Atualizando badge...');
  await syncStateManager.refreshPendingCount();
  const state = syncStateManager.getState();
  console.log('✅ Badge atualizado:', state.pendingPush, 'pendente(s)');
  return state.pendingPush;
};

/**
 * 🎯 Verificar listeners duplicados
 */
window.checkDuplicateListeners = function() {
  const onlineListeners = getEventListeners(window).online || [];
  const offlineListeners = getEventListeners(window).offline || [];
  
  console.group('🎯 Listeners de Rede');
  console.log('Listeners "online":', onlineListeners.length);
  console.log('Listeners "offline":', offlineListeners.length);
  
  if (onlineListeners.length > 1) {
    console.warn('⚠️ DUPLICAÇÃO: Mais de 1 listener "online" detectado!');
  }
  if (offlineListeners.length > 1) {
    console.warn('⚠️ DUPLICAÇÃO: Mais de 1 listener "offline" detectado!');
  }
  
  console.groupEnd();
  
  return {
    online: onlineListeners.length,
    offline: offlineListeners.length
  };
};

/**
 * 🧪 Simular desconexão (DevTools)
 */
window.simulateOffline = function() {
  console.log('🔴 Simulando offline...');
  console.log('⚠️ Use DevTools → Network → Offline checkbox para desconexão real');
  window.dispatchEvent(new Event('offline'));
};

/**
 * 🧪 Simular reconexão (DevTools)
 */
window.simulateOnline = function() {
  console.log('🟢 Simulando online...');
  console.log('⚠️ Use DevTools → Network → Desmarcar Offline para reconexão real');
  window.dispatchEvent(new Event('online'));
};

/**
 * 📊 Ver todas as preferências de sync
 */
window.getSyncPrefs = function() {
  const prefs = JSON.parse(localStorage.getItem('sync_preferences') || '{}');
  
  console.group('📊 Preferências de Sync');
  console.log('Auto Pull on Start:', prefs.autoPullOnStart ?? true);
  console.log('Auto Push on Exit:', prefs.autoPushOnExit ?? true);
  console.log('Periodic Pull Enabled:', prefs.periodicPullEnabled ?? false);
  console.log('Periodic Pull Interval:', prefs.periodicPullInterval ?? 5, 'minutos');
  console.log('Realtime Enabled:', prefs.realtimeEnabled ?? false);
  console.groupEnd();
  
  return prefs;
};

/**
 * ⚙️ Habilitar periodic sync de 30 segundos
 */
window.enablePeriodicSync30s = function() {
  const prefs = {
    autoPullOnStart: true,
    autoPushOnExit: true,
    periodicPullEnabled: true,
    periodicPullInterval: 0.5, // 30 segundos = 0.5 minutos
    realtimeEnabled: false
  };
  
  localStorage.setItem('sync_preferences', JSON.stringify(prefs));
  console.log('✅ Periodic sync habilitado para 30 segundos');
  console.log('⚠️ RECARREGUE a página (F5) para aplicar');
  return prefs;
};

/**
 * 🧹 Limpar todos os dados dirty (USE COM CUIDADO!)
 */
window.clearAllDirty = async function() {
  const confirmed = confirm('⚠️ Isso irá LIMPAR TODOS os registros dirty.\n\nDADOS PENDENTES SERÃO PERDIDOS!\n\nTem certeza?');
  
  if (!confirmed) {
    console.log('❌ Operação cancelada');
    return;
  }
  
  console.log('🧹 Limpando registros dirty...');
  
  const tables = ['projects', 'installations', 'contacts', 'budgets', 'itemVersions', 'files'];
  const results = {};
  
  for (const table of tables) {
    const dirty = await db[table].where('_dirty').equals(1).toArray();
    results[table] = dirty.length;
    
    for (const record of dirty) {
      await db[table].update(record.id, { _dirty: 0 });
    }
  }
  
  await syncStateManager.refreshPendingCount();
  
  console.group('🧹 Limpeza Concluída');
  console.log('Registros limpos:', results);
  console.log('Total:', Object.values(results).reduce((sum, val) => sum + val, 0));
  console.groupEnd();
  
  return results;
};

/**
 * 📝 Gerar relatório completo
 */
window.generateReport = async function() {
  console.clear();
  console.log('═════════════════════════════════════════════');
  console.log('  📝 RELATÓRIO COMPLETO DE SINCRONIZAÇÃO');
  console.log('═════════════════════════════════════════════');
  console.log('Data:', new Date().toLocaleString());
  console.log('');
  
  await window.debugSync();
  console.log('');
  
  await window.countDirty();
  console.log('');
  
  await window.getLastPull();
  console.log('');
  
  window.getSyncPrefs();
  console.log('');
  
  window.checkDuplicateListeners();
  console.log('');
  
  console.log('═════════════════════════════════════════════');
};

/**
 * 🔍 Monitorar sync em tempo real
 */
window.monitorSync = function() {
  console.log('🔍 Monitorando sync... (Pressione Ctrl+C para parar)');
  
  const unsubscribe = syncStateManager.subscribe((state) => {
    console.log('🔄 Estado mudou:', {
      status: state.status,
      isOnline: state.isOnline,
      pendingPush: state.pendingPush,
      timestamp: new Date().toLocaleTimeString()
    });
  });
  
  console.log('✅ Monitor ativo. Execute window.stopMonitor() para parar');
  window.stopMonitor = () => {
    unsubscribe();
    console.log('⏹️ Monitor parado');
  };
};

/**
 * 🧪 Criar projeto de teste
 */
window.createTestProject = async function(name = 'Projeto Teste') {
  console.log('🧪 Criando projeto de teste:', name);
  
  const { StorageManagerDexie } = await import('./services/storage/StorageManagerDexie');
  
  const project = {
    name: name,
    client: 'Cliente Teste',
    city: 'São Paulo',
    code: `TEST-${Date.now()}`,
    status: 'active'
  };
  
  const saved = await StorageManagerDexie.upsertProject(project);
  console.log('✅ Projeto criado:', saved);
  
  await window.refreshBadge();
  
  return saved;
};

// ===========================================
// INICIALIZAÇÃO
// ===========================================

console.clear();
console.log('═════════════════════════════════════════════');
console.log('  🛠️ DEBUG HELPERS CARREGADOS');
console.log('═════════════════════════════════════════════');
console.log('');
console.log('Funções disponíveis:');
console.log('');
console.log('📊 debugSync()              - Ver estado do sync');
console.log('🔢 countDirty()             - Contar registros dirty');
console.log('📋 listDirtyProjects()      - Listar projetos dirty');
console.log('🕐 getLastPull()            - Ver último pull timestamp');
console.log('🔄 refreshBadge()           - Forçar atualização do badge');
console.log('🎯 checkDuplicateListeners() - Verificar listeners duplicados');
console.log('🧪 simulateOffline()        - Simular desconexão');
console.log('🧪 simulateOnline()         - Simular reconexão');
console.log('📊 getSyncPrefs()           - Ver preferências');
console.log('⚙️ enablePeriodicSync30s()  - Habilitar sync de 30s');
console.log('🧹 clearAllDirty()          - Limpar dirty (CUIDADO!)');
console.log('📝 generateReport()         - Gerar relatório completo');
console.log('🔍 monitorSync()            - Monitorar em tempo real');
console.log('🧪 createTestProject()      - Criar projeto de teste');
console.log('');
console.log('═════════════════════════════════════════════');
console.log('');
console.log('💡 Dica: Execute generateReport() para começar');
console.log('');
