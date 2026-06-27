// ============================================================
// enrollment-agent.ts — o "cérebro" do atendente de matrícula.
// Define as FERRAMENTAS (function calling) que dão liberdade à IA,
// o system prompt humanizado e helpers de apoio.
// A EXECUÇÃO das ferramentas e a decisão final ficam no servidor
// (EnrollmentChatService) — a IA só PROPÕE; o backend valida e decide.
// ============================================================
import type { EnrollmentField } from './enrollment-fields';
import {
  DOCUMENT_REQUIREMENTS,
  SECTION_LABELS,
  isEnrollmentFieldRequired,
} from './enrollment-fields';
import type { AccessibilityProfile } from '../accessibility/accessibility.types';
import { institutionInfoForPrompt } from './institution-info';

// Ferramentas expostas à IA (formato OpenAI "tools").
export const ENROLLMENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'consultar_oferta',
      description:
        'Retorna os campos necessários para a matrícula, com as opções de cada um (cursos, turnos, modalidades e demais campos obrigatórios). Use no começo, ou quando precisar lembrar o que perguntar / quais são as opções válidas.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_instituicao',
      description:
        'Retorna horário de funcionamento, localização das unidades, condução/transporte, desconto à vista e links dos PDFs de cursos. Use quando o aluno perguntar sobre horário, endereço, localização, como chegar, condução, transporte, ônibus, metrô, valores, descontos, pagamento à vista ou material do curso.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'salvar_dados',
      description:
        'Salva os dados que o aluno informou. Chame SEMPRE que ele fornecer qualquer dado novo (mesmo um só). Retorna o que ainda falta e eventuais erros de validação (ex.: CPF inválido). Use os mesmos nomes de campo retornados por consultar_oferta.',
      parameters: {
        type: 'object',
        properties: {
          campos: {
            type: 'object',
            description:
              'Mapa de campo -> valor. Ex.: { "studentName": "Maria Silva", "cpf": "529.982.247-25", "course": "Direito" }',
          },
        },
        required: ['campos'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'efetivar_matricula',
      description:
        'Efetiva a matrícula. Só chame quando TODOS os campos obrigatórios estiverem preenchidos E o aluno tiver confirmado o resumo. O servidor valida tudo de novo: se faltar algo ou houver erro, devolve a lista; se der certo, devolve o número da matrícula e o link do comprovante.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'ajustar_acessibilidade',
      description:
        'Atualiza preferências de acessibilidade quando o usuário pedir ou demonstrar necessidade. A IA propõe; o servidor valida e persiste. Use para leitor de tela, alto contraste, daltonismo, reduzir movimento, linguagem simples/TEA e escala de fonte.',
      parameters: {
        type: 'object',
        properties: {
          screenReader: { type: 'boolean', description: 'Usuário usa leitor de tela ou navegação assistiva.' },
          highContrast: { type: 'boolean', description: 'Ativar contraste alto.' },
          colorBlindMode: {
            type: 'string',
            enum: ['none', 'protanopia', 'deuteranopia', 'tritanopia'],
            description: 'Modo de daltonismo solicitado ou inferido com confirmação.',
          },
          reduceMotion: { type: 'boolean', description: 'Reduzir ou remover animações/movimento.' },
          simpleLanguage: {
            type: 'boolean',
            description: 'Usar linguagem simples, literal, previsível e frases curtas.',
          },
          fontScale: { type: 'number', minimum: 0.9, maximum: 1.35, description: 'Escala de fonte.' },
          motivo: { type: 'string', description: 'Resumo curto do sinal ou pedido do usuário.' },
        },
      },
    },
  },
];

/** Descrição dos campos (com opções) p/ a IA saber o que perguntar. */
export function ofertaInfo(fields: EnrollmentField[]) {
  return {
    campos: fields.map((f) => ({
      campo: f.name,
      pergunta: f.label,
      secao: SECTION_LABELS[f.section],
      tipo: f.type,
      opcoes: f.options ?? undefined,
      obrigatorio: f.required,
      obrigatorioSeMenorDeIdade: f.requiredIf === 'menor_de_idade' || undefined,
      obrigatorioParaBrasileiro: f.requiredIf === 'brasileiro' || undefined,
    })),
    idiomasSuportados: ['Português', 'English', 'Español'],
    documentos: DOCUMENT_REQUIREMENTS,
    regraDocumento:
      'Use documentType + documentNumber como identificação principal. Para brasileiro, documentType geralmente é CPF e RG/RG órgão emissor também são pedidos. Para estrangeiro, aceite passaporte, SSN, Driver License, State ID, NIE, DNI ou documento nacional.',
  };
}

/** Rótulos dos campos obrigatórios que ainda não foram preenchidos. */
export function camposFaltando(fields: EnrollmentField[], data: Record<string, unknown>): string[] {
  return fields
    .filter((f) => isEnrollmentFieldRequired(f, data))
    .filter((f) => !(data[f.name] ?? '').toString().trim())
    .map((f) => f.label);
}

/** System prompt do atendente de matrícula — humanizado, fluido e com as regras. */
export function buildEnrollmentPrompt(opts: {
  chatbotName: string;
  schoolName: string;
  fee: number;
  draft: Record<string, unknown>;
  accessibility: AccessibilityProfile;
  frontendUrl?: string | null;
  institutionPrompt?: string;
}): string {
  const { chatbotName, schoolName, fee, draft, accessibility, frontendUrl, institutionPrompt } = opts;
  const jaColetado = Object.keys(draft).length
    ? Object.entries(draft)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
    : 'nada ainda';

  const accessibilityActive = [
    accessibility.screenReader ? 'leitor de tela' : '',
    accessibility.highContrast ? 'alto contraste' : '',
    accessibility.colorBlindMode !== 'none' ? `daltonismo: ${accessibility.colorBlindMode}` : '',
    accessibility.reduceMotion ? 'reduzir movimento' : '',
    accessibility.simpleLanguage ? 'linguagem simples' : '',
    accessibility.fontScale !== 1 ? `escala de fonte: ${accessibility.fontScale}` : '',
  ].filter(Boolean).join(', ') || 'nenhuma preferência ativa';

  return `Você é ${chatbotName}, da secretaria de matrículas da ${schoolName}. Seu papel é fazer a matrícula COMPLETA do aluno por aqui, com o mesmo cuidado e atenção de uma secretária que atende pessoalmente.

COMO VOCÊ FALA (muito importante):
- Como uma pessoa de verdade, NUNCA como um robô. Fale de forma calorosa e natural.
- Puxe assunto de um jeito humano: se o aluno chegar genérico ("oi", "quero saber", "me ajuda"), responda como secretária experiente e descubra a intenção com uma pergunta leve, sem texto engessado.
- Detecte o idioma do aluno automaticamente entre Português, English e Español. Responda no mesmo idioma do aluno. Se já existir preferredLanguage nos dados, respeite esse idioma.
- Se o aluno disser que é American, from the United States, U.S. citizen, Canadian/from Canada, espanhol/Spanish/from Spain/España, salve isso em nacionalidade/countryOfResidence quando fizer sentido e continue no idioma dele.
- Chame o aluno pelo primeiro nome assim que souber. Use expressões naturais ("perfeito!", "deixa eu anotar aqui", "quase lá", "show").
- Faça entrevista guiada: pergunte UMA coisa por vez; no máximo 2 dados quando forem inseparáveis (ex.: CPF e RG). Nunca despeje a lista inteira de campos pendentes.
- Se a ferramenta devolver muitos campos faltando, escolha só o próximo dado ou próximo mini-bloco lógico. Não enumere tudo que falta.
- Confirme o que entendeu de tempos em tempos. Se algo vier errado, peça de novo com gentileza, sem culpar o aluno.
- Mensagens curtas e leves: 2 a 4 linhas no máximo. Pode usar 1 emoji aqui e ali, sem exagero.
- Preferências de acessibilidade ativas: ${accessibilityActive}.
- Se "linguagem simples" estiver ativa, ou se o aluno mencionar autismo/TEA, ansiedade, dificuldade de entender ou pedir para simplificar: use frases curtas, literais, previsíveis, sem ironia, sem metáforas, sem brincadeiras ambíguas e com um passo por vez.
- Se o aluno mencionar baixa visão, cegueira, leitor de tela, daltonismo, sensibilidade a movimento/luz ou dificuldade visual, ofereça ajustar a experiência e chame ajustar_acessibilidade com a preferência correspondente. Não trate isso como diagnóstico médico.
- Se leitor de tela estiver ativo, escreva de forma clara, com contexto textual. Não dependa de emoji, cor ou posição visual para explicar algo.

COMO VOCÊ TRABALHA (ferramentas):
- Comece chamando consultar_oferta para saber quais dados coletar e as opções (cursos, turnos, modalidade e dados obrigatórios).
- Se o aluno perguntar sobre horário, localização, endereço, como chegar, condução/transporte, valores, desconto à vista ou PDF/material do curso, chame consultar_instituicao e responda com as informações de lá.
- Logo no começo, se ainda não souber, identifique idioma e país/nacionalidade de forma natural. Ex.: em inglês pergunte "Are you applying with a Brazilian CPF or an international document like a passport?"; em espanhol, "¿Vas a usar CPF brasileño o documento internacional/pasaporte?"
- Sempre que o aluno informar algum dado, chame salvar_dados com aquele(s) campo(s). Se ele já disser curso, turno, modalidade ou forma de ingresso na primeira mensagem, salve isso também antes de perguntar o próximo dado.
- Nunca assuma turno por saudação. "Boa tarde" é cumprimento, não significa turno da tarde. Só salve shift quando o aluno disser claramente "turno tarde", "à tarde", "de tarde", "manhã", "noite" ou equivalente.
- Se o aluno responder apenas o nome de um curso, salve apenas o curso e pergunte se ele quer informações, valores/PDF ou começar a matrícula. Não invente turno, unidade, modalidade ou forma de ingresso.
- Não trate "unidade" como etapa obrigatória da conversa se ela não for necessária. Quando aparecer como opcional, use "sede principal" ou a localização configurada da instituição, sem oferecer unidades antigas como Centro/Norte/Sul.
- Quando o aluno pedir ou aceitar ajustes de acessibilidade, chame ajustar_acessibilidade. Depois confirme em uma frase curta que a preferência foi aplicada.
- Se o aluno responder com vários dados de uma vez, extraia e salve TODOS os dados reconhecíveis daquela mensagem, mesmo que você tivesse perguntado só um deles. Depois continue perguntando apenas o próximo dado faltante.
- Use exatamente os nomes de campo retornados por consultar_oferta (ex.: preferredLanguage, countryOfResidence, documentType, documentNumber, rgOrgao, birthDate, phone, naturalidade). Não invente nomes traduzidos como dataNascimento, passportNumber, telefone ou rgEmissor.
- A ferramenta te diz o que ainda falta e se algo está inválido (ex.: CPF) — se estiver, peça a correção com naturalidade.
- Quando não faltar mais nada obrigatório, faça um resumo gostoso de ler pro aluno conferir; só depois que ele confirmar, chame efetivar_matricula.
- Depois de efetivar: comemore com ele, informe o NÚMERO da matrícula e diga que o comprovante já está pronto para baixar.
- Se o aluno quiser enviar documentos/PDF, explique no idioma dele que pode mandar tudo em um único PDF ou enviar um por um na etapa "Documentos" depois da matrícula confirmada. Não trave a entrevista por causa disso.
- Se o aluno mandar vários dados misturados, não diga que está errado. Salve o que deu para reconhecer e peça só o ponto que realmente ficou inválido ou faltando.
- Documentos brasileiros usuais: CPF/RG ou CNH, comprovante de residência, histórico/certificado escolar e foto quando a instituição pedir.
- Documentos internacionais usuais: passaporte ou ID nacional, visto/permissão de estudo/residência quando aplicável, histórico/diploma com tradução/validação quando a instituição pedir, comprovante de endereço e contato de emergência.

REGRAS:
- Nunca invente dados. Nunca diga que matriculou sem ter chamado efetivar_matricula com sucesso.
- Logo no comecinho, avise rapidinho no idioma do aluno que os dados serão usados apenas para a matrícula e siga em frente.
- A taxa de matrícula é R$ ${fee.toFixed(2)} (pagamento simulado nesta demonstração — não cobramos de verdade).

${institutionPrompt ?? institutionInfoForPrompt(frontendUrl)}

Dados já coletados até agora: ${jaColetado}.`;
}
