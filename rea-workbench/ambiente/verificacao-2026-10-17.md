# Verificação de ambiente REA — 2026-10-17

## Host
| Item | Resultado |
|---|---|
| SO | Windows 11 Pro 10.0.22000, x64 (AMD64) |
| Shell | Git Bash (MINGW64) + PowerShell 5.1 |
| Node.js | v26.5.0 (compatível: engines `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0`) |
| npm / npx | 11.17.0 |
| Bun | presente (`~/.bun/bin/bun`) |
| git | 2.55.0.windows.2 |
| Python | 3.12.10 (`python`; `python3` é alias da Microsoft Store) |
| Java / JDK | **ausente** (`java`, `javac`, `JAVA_HOME` não encontrados) |

## REA
| Item | Resultado |
|---|---|
| `rea` no PATH | **não encontrado** |
| `rea-agents` global (npm) | **não instalado** |
| Registro MCP em `~/.claude.json` | inexistente |
| Skill `~/.claude/skills/reverse-engineer-anything` | inexistente |
| Estado `~/.rea` | inexistente |
| Versão publicada (npm, `latest`) | **6.5.0** (MIT, modificado em 2026-10-14) |
| Mantenedor npm | morluto |
| Repositório | git+https://github.com/morluto/rea.git |

## Provedores e ferramentas auxiliares
| Provedor/ferramenta | Situação | Observação |
|---|---|---|
| Ghidra | ausente | Windows x64 é **experimental** (P0, 26 operações somente leitura); exige Ghidra 12.1.x + JDK 21+ 64-bit |
| Hopper | n/a | não disponível para Windows |
| IDA | ausente | usa instalação existente do usuário (licença própria) |
| objdump / Rizin | ausentes | fornecidos pelo usuário |
| JADX / Apktool / adb | ausentes | Android exige JADX + JDK |
| TShark, GDB, WABT | ausentes | PCAP/GDB são majoritariamente Linux |
| Chrome / Edge | **presentes** | habilita análise web via CDP |

## Capacidades esperadas neste host (sem instalar nada além do REA)
- Disponíveis: JavaScript/Electron (diretório ou ASAR), .NET estático, binários Go e Rust (PE estático), SQLite (Node 26+), WASM, artefatos/pacotes, sites via Chrome (CDP), HAR/SAZ.
- Indisponíveis até instalar dependências: descompilação nativa (Ghidra + JDK ou IDA), Android (JADX + JDK).
- Indisponíveis no Windows nativo: captura de processo, `import-reference-source`, firmware, PCAP, sinais (usar WSL).

> Pendente de confirmação real: estas capacidades vêm da documentação; só `rea doctor --json` e `rea capabilities --json` as comprovam.

## Comandos executados (somente leitura)
```
uname -a; node/npm/npx/git/python/java --version
command -v rea; npm ls -g --depth=0
npm view rea-agents name version description license engines bin repository.url dist-tags time.modified maintainers --json
command -v java javac adb jadx apktool objdump rizin r2 gdb tshark wasm-objdump bun
ls (locais comuns de Ghidra/IDA/JDK/Chrome/Edge); grep '"rea"' ~/.claude.json
```

## Diagnóstico real via npx (autorizado pelo usuário, sem instalação global)
| Comando | Exit | Evidência |
|---|---|---|
| `npx -y rea-agents@6.5.0 --help` | 0 | `evidencias/help.txt` |
| `npx -y rea-agents@6.5.0 doctor --json` | 1 (`healthy:false`) | `evidencias/doctor.json` |
| `npx -y rea-agents@6.5.0 providers --json` | 0 | `evidencias/providers.json` |
| `npx -y rea-agents@6.5.0 capabilities --json` | 0 | `evidencias/capabilities.json`, `evidencias/capabilities-resumo.json` |

**doctor:** node 26.5.0 e host win32 x64 saudáveis. Falham: hopper, ghidra (`GHIDRA_INSTALL_DIR` ausente), ida (`REA_IDA_MCP_CONFIG` ausente), jadx (`REA_JADX_MCP_JAR` ausente) — todos `missing_analysis_engine`. Skill e registros (claude_code, claude_desktop, copilot_cli, vscode) em `config_drift` porque o REA nunca foi registrado.

**Operações de provedor disponíveis:** `rea-artifact-graph` (inspect_artifact, extract_artifact, decode_interface_builder, inspect_keyed_archive, trace_dylib_resolution), `rea-dotnet-static` (inspect_managed_artifact, inspect_managed_members, inspect_managed_native_boundaries), `sqlite` (inspect_sqlite_database).
**Indisponíveis:** `native-macos` (9 ops) e `inspect_asset_catalog` — `unsupported_host`.
Comandos de JS/web (`analyze-javascript-application`, `analyze-web-bundle`, `export-web-scripts`, `capture-browser-scenario`) constam no `--help` e não dependem de provedor nativo.

## Fontes consultadas
- https://github.com/morluto/rea (README)
- docs/installation.md (lido parcialmente), docs/cli.md, docs/windows-ghidra-p0.md, docs/mcp-contracts.md (parcial), DISCLAIMER.md
