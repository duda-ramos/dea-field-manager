# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Sistema de detecção de conflitos agora ativo na sincronização
- Notificações automáticas de conflitos durante pull
- Resolução manual de conflitos com interface intuitiva
- Badge no header indicando conflitos pendentes
- Modal de resolução de conflitos com comparação lado a lado

### Changed
- Sincronização agora detecta e reporta conflitos de edição simultânea
- Pull operations verificam conflitos antes de aplicar mudanças remotas
- Registros com edições locais não são sobrescritos automaticamente quando há conflito

### Technical Details
- Conflitos são detectados comparando timestamps e conteúdo
- Sistema preserva tanto a versão local quanto a remota
- Usuário pode escolher qual versão manter ou mesclar manualmente
- Conflitos resolvidos são marcados com _forceUpload para garantir upload