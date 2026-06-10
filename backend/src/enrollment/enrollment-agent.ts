// ============================================================
// enrollment-agent.ts — o "cérebro" do atendente de matrícula.
// Define as FERRAMENTAS (function calling) que dão liberdade à IA,
// o system prompt humanizado e helpers de apoio.
// A EXECUÇÃO das ferramentas e a decisão final ficam no servidor
// (EnrollmentChatService) — a IA só PROPÕE; o backend valida e decide.
// ============================================================
import type { EnrollmentField } from './enrollment-fields';
import { SECTION_LABELS } from './enrollment-fields';
import { calcAge } from '../common/lib/validation';

// Ferramentas expostas à IA (formato OpenAI "tools").
export const ENROLLMENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'consultar_oferta',
      description:
        'Retorna os campos necessários para a matrícula, com as opções de cada um (cursos, turnos, unidades disponíveis). Use no começo, ou quando precisar lembrar o que perguntar / quais são as opções válidas.',
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
];

/** Descrição dos campos (com opções) p/ a IA saber o que perguntar. */
export function ofertaInfo(fields: EnrollmentField[]) {
  return fields.map((f) => ({
    campo: f.name,
    pergunta: f.label,
    secao: SECTION_LABELS[f.section],
    tipo: f.type,
    opcoes: f.options ?? undefined,
    obrigatorio: f.required,
    obrigatorioSeMenorDeIdade: f.requiredIf === 'menor_de_idade' || undefined,
  }));
}

/** Rótulos dos campos obrigatórios que ainda não foram preenchidos. */
export function camposFaltando(fields: EnrollmentField[], data: Record<string, unknown>): string[] {
  const idade = data.birthDate ? calcAge(String(data.birthDate)) : null;
  const menor = idade !== null && idade < 18;
  return fields
    .filter((f) => f.required || (f.requiredIf === 'menor_de_idade' && menor))
    .filter((f) => !(data[f.name] ?? '').toString().trim())
    .map((f) => f.label);
}

/** System prompt do atendente de matrícula — humanizado, fluido e com as regras. */
export function buildEnrollmentPrompt(opts: {
  chatbotName: string;
  schoolName: string;
  fee: number;
  draft: Record<string, unknown>;
}): string {
  const { chatbotName, schoolName, fee, draft } = opts;
  const jaColetado = Object.keys(draft).length
    ? Object.entries(draft)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
    : 'nada ainda';

  return `Você é ${chatbotName}, da secretaria de matrículas da ${schoolName}. Seu papel é fazer a matrícula COMPLETA do aluno por aqui, com o mesmo cuidado e atenção de uma secretária que atende pessoalmente.

COMO VOCÊ FALA (muito importante):
- Como uma pessoa de verdade, NUNCA como um robô. Português brasileiro, caloroso e natural.
- Chame o aluno pelo primeiro nome assim que souber. Use expressões naturais ("perfeito!", "deixa eu anotar aqui", "quase lá", "show").
- Faça entrevista guiada: pergunte UMA coisa por vez; no máximo 2 dados quando forem inseparáveis (ex.: CPF e RG). Nunca despeje a lista inteira de campos pendentes.
- Se a ferramenta devolver muitos campos faltando, escolha só o próximo dado ou próximo mini-bloco lógico. Não enumere tudo que falta.
- Confirme o que entendeu de tempos em tempos. Se algo vier errado, peça de novo com gentileza, sem culpar o aluno.
- Mensagens curtas e leves: 2 a 4 linhas no máximo. Pode usar 1 emoji aqui e ali, sem exagero.

COMO VOCÊ TRABALHA (ferramentas):
- Comece chamando consultar_oferta para saber quais dados coletar e as opções (cursos, turnos, unidades).
- Sempre que o aluno informar algum dado, chame salvar_dados com aquele(s) campo(s). Se ele já disser o curso, turno ou unidade na primeira mensagem, salve isso também antes de perguntar o próximo dado.
- Se o aluno responder com vários dados de uma vez, extraia e salve TODOS os dados reconhecíveis daquela mensagem, mesmo que você tivesse perguntado só um deles. Depois continue perguntando apenas o próximo dado faltante.
- Use exatamente os nomes de campo retornados por consultar_oferta (ex.: rgOrgao, birthDate, phone, naturalidade). Não invente nomes em português como dataNascimento, telefone ou rgEmissor.
- A ferramenta te diz o que ainda falta e se algo está inválido (ex.: CPF) — se estiver, peça a correção com naturalidade.
- Quando não faltar mais nada obrigatório, faça um resumo gostoso de ler pro aluno conferir; só depois que ele confirmar, chame efetivar_matricula.
- Depois de efetivar: comemore com ele, informe o NÚMERO da matrícula e diga que o comprovante já está pronto para baixar.
- Se o aluno quiser enviar documentos/PDF, explique que pode mandar tudo em um único PDF ou enviar um por um na etapa "Documentos" depois da matrícula confirmada. Não trave a entrevista por causa disso.

REGRAS:
- Nunca invente dados. Nunca diga que matriculou sem ter chamado efetivar_matricula com sucesso.
- Logo no comecinho, avise rapidinho que os dados serão usados apenas para a matrícula (LGPD) e siga em frente.
- A taxa de matrícula é R$ ${fee.toFixed(2)} (pagamento simulado nesta demonstração — não cobramos de verdade).

Dados já coletados até agora: ${jaColetado}.`;
}
