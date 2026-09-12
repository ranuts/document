import type { I18nMessages } from '../types';

/**
 * The `pt` message table.
 * Filled in from en.json where a translation is missing, which is what keeps
 * an untranslated string showing in English rather than as a raw key.
 *
 * Interpolation placeholders ({size}, {title}, {when}, {days}, {count},
 * {page}, {pages}) have to survive translation verbatim -- the
 * message-placeholders cases in test/unit/i18n.test.ts check that.
 */
export const pt: Partial<I18nMessages> = {
  webOffice: 'Web Office',
  uploadDocument: 'Abrir / editar documento',
  newWord: 'Novo documento do Word',
  newExcel: 'Nova planilha do Excel',
  newPowerPoint: 'Nova apresentação do PowerPoint',
  themeLabel: 'Tema',
  themeSystem: 'Sistema',
  themeLight: 'Claro',
  themeDark: 'Escuro',
  fileSavedSuccess: 'Arquivo salvo: ',
  documentLoaded: 'Documento carregado: ',
  failedToLoadEditor: 'Não foi possível carregar o editor. Verifique se a API do OnlyOffice está instalada.',
  unsupportedFileType: 'Tipo de arquivo não suportado: ',
  invalidFileObject: 'Arquivo inválido',
  documentOperationFailed: 'Falha na operação do documento: ',
  openUrlFailed: 'Não foi possível abrir esse link: ',
  openUrlUnreachable:
    'Não foi possível obter o arquivo. O site pode não permitir que outras páginas leiam seus arquivos, ou a rede está indisponível. Baixe o arquivo e abra-o a partir do seu dispositivo.',
  editorErrorToast: 'Erro no documento',
  editorErrorFormatMismatch: 'O conteúdo do arquivo não corresponde à extensão; verifique o formato e tente novamente',
  editorErrorOpenFailed:
    'Não foi possível abrir o arquivo: ele pode estar corrompido, em formato não suportado ou não corresponder à extensão',
  editorErrorOutOfMemory:
    'Este navegador não conseguiu reservar memória para o motor de conversão de documentos (cerca de {mb} MB). Feche outras abas ou janelas e tente novamente; se continuar falhando, use um navegador de 64 bits (Edge ou Chrome de 64 bits).',
  editorOpenRetrying:
    'O editor não estava pronto quando o documento foi aberto; a tentar novamente de forma automática…',
  agentTitle: 'Assistente de IA',
  agentOpenTip: 'Abrir o assistente de IA',
  agentSettings: 'Configurações',
  agentRoleUser: 'Você',
  agentRoleTool: 'Ferramenta',
  agentRoleError: 'Erro',
  agentProviderClaude: 'Claude (nuvem, precisa de chave de API)',
  agentProviderOpenAI: 'OpenAI (nuvem, precisa de chave de API)',
  agentProviderGemini: 'Gemini (nuvem, precisa de chave de API)',
  agentProviderLocal: 'Local sem ligação (WebLLM, precisa de WebGPU)',
  agentProviderOllama: 'Ollama (servidor local, executado por si)',
  agentOllamaModelPlaceholder: 'Nome do modelo, por exemplo llama3.2',
  agentOllamaHint:
    'Conecta ao Ollama local (http://localhost:11434); não precisa de chave de API — confirme que o modelo está rodando.',
  agentLoadModel: 'Carregar modelo',
  agentModelLoaded: 'Modelo carregado — já pode começar a conversar.',
  agentCheckingCache: 'A verificar a cache do modelo…',
  agentModelCached:
    'Este modelo já está em cache — clique em «Carregar modelo» para começar na hora (recarregar a página não baixa de novo).',
  agentModelFirstDownload:
    'No primeiro uso o modelo é baixado ({size}); depois fica em cache, então recarregar a página não baixa de novo.',
  agentNoWebGPU: 'Este navegador não suporta WebGPU, pelo que o modo local não está disponível.',
  agentLocalChatOnly:
    'O modelo local apenas responde e reescreve — não edita o documento diretamente. Para que a IA edite, ',
  agentSwitchCloud: 'mude para a nuvem →',
  agentReviewMode: 'Registo de alterações',
  agentQuote: 'Citar a seleção',
  agentQuoteTip: 'Cita na caixa de texto o que estiver selecionado no documento, na folha de cálculo ou no diapositivo',
  agentClear: 'Limpar a conversa',
  agentInputPlaceholder: 'Peça à IA para editar o documento… (Enter envia, Shift+Enter muda de linha)',
  agentSend: 'Enviar',
  agentStop: 'Parar',
  agentNeedKey: 'Introduza primeiro uma chave de API.',
  agentNoSelection: 'Não há nada selecionado — selecione primeiro texto no documento.',
  agentQuotePrefix: 'Tenha em conta o conteúdo que selecionei:',
  agentStopped: 'Parado.',
  agentMaxSteps: 'Foi atingido o número máximo de passos; processo parado.',
  agentToolCallPrefix: 'Chamada de ferramenta: ',
  agentToolErrorPrefix: 'Erro da ferramenta: ',
  autosaveStopped:
    'O salvamento automático parou: este navegador ficou sem espaço. Exporte este documento e apague alguns dos que estão salvos.',
  historyTitle: 'Documentos salvos',
  historyIntro:
    'Cópias dos documentos que editou, mantidas neste navegador e neste dispositivo, para que recarregar, fechar um separador ou uma falha não lhe custem o trabalho. Nada disto foi enviado para a Internet.',
  historyColDocument: 'Documento',
  historyColEdited: 'Última edição',
  historyColSize: 'Tamanho',
  historyColExpires: 'Apaga-se',
  historyNotBackup:
    'Estas cópias servem para retomar o que ficou pela metade. Não são um backup — exporte tudo o que quiser manter.',
  historySearchPlaceholder: 'Buscar pelo nome do arquivo',
  historyEmpty: 'Ainda não há nada salvo. Os documentos que você editar aqui aparecem sozinhos nesta lista.',
  historyEmptySearch: 'Nenhum nome de arquivo corresponde a essa busca.',
  historyOpen: 'Abrir',
  historyDelete: 'Eliminar',
  historyDeleteConfirm: 'Excluir «{title}» e todas as cópias salvas? Não dá para desfazer.',
  historyClearAll: 'Eliminar tudo',
  historyClearConfirm: 'Excluir todas as cópias de documentos salvas neste dispositivo? Não dá para desfazer.',
  historyUnsaved: 'por exportar',
  historyUsage: '{size} em uso',
  historyCount: '{count} documentos',
  historyPageInfo: 'Página {page} de {pages}',
  historyPrev: 'Anterior',
  historyNext: 'Seguinte',
  historyBack: 'Abrir o editor',
  historyAutosaveLabel: 'Gravação automática',
  historyAutosaveOff:
    'O salvamento automático está desligado: o que você editar agora não fica salvo e se perde ao fechar a página.',
  historyRetention:
    'Cada documento é eliminado automaticamente 7 dias depois de o ter editado ou aberto pela última vez. Também pode apagar aqui o que quiser, com efeito imediato.',
  historyExpiresIn: 'faltam {days} dias',
  historyExpiresInOne: 'falta 1 dia',
  historyExpiresToday: 'hoje',
  historyDownload: 'Baixar',
  historyDownloadFailed: 'Não foi possível salvar essa cópia no disco.',
  historyOnlyUnsaved: 'Não exportados',
  historyOpenFile: 'Abrir um arquivo',
  historyRailSettings: 'Configurações',
  historyRailRetention: 'Retenção',
  historyCancel: 'Cancelar',
  historyChip: 'Neste dispositivo · nunca enviado',
  historyEmptyTitle: 'Ainda não há nada salvo',
  historyEmptySearchTitle: 'Sem resultados',
  historyClearSearch: 'Limpar a procura',
  historyDeleteTitle: 'Eliminar este documento',
  historyClearTitle: 'Eliminar tudo',
};
