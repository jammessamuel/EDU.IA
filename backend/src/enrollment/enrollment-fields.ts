// ============================================================
// enrollment-fields.ts — definição dos campos da matrícula completa.
// Organizados em SEÇÕES (como uma ficha de matrícula presencial).
// Estes campos alimentam: a validação, o prompt da IA (Fase 2) e o PDF.
// Por enquanto são fixos p/ Educação; depois viram configuráveis por escola.
// ============================================================
import { isValidCpf, isValidEmail, calcAge } from '../common/lib/validation';

export type FieldType = 'text' | 'select' | 'cpf' | 'email' | 'date' | 'cep' | 'phone';
export type Section =
  | 'pessoais'
  | 'contato'
  | 'endereco'
  | 'academico'
  | 'escolaridade'
  | 'responsavel'
  | 'pagamento';

export interface EnrollmentField {
  name: string;
  label: string;
  section: Section;
  type: FieldType;
  options?: string[];
  required: boolean;
  /** Obrigatório só em certas condições (ex.: responsável quando o aluno é menor). */
  requiredIf?: 'menor_de_idade';
}

export const SECTION_LABELS: Record<Section, string> = {
  pessoais: 'Dados pessoais',
  contato: 'Contato',
  endereco: 'Endereço',
  academico: 'Dados acadêmicos',
  escolaridade: 'Escolaridade anterior',
  responsavel: 'Responsável legal',
  pagamento: 'Pagamento',
};

export const EDUCATION_ENROLLMENT_FIELDS: EnrollmentField[] = [
  // Dados pessoais
  { name: 'studentName', label: 'Nome completo', section: 'pessoais', type: 'text', required: true },
  { name: 'cpf', label: 'CPF', section: 'pessoais', type: 'cpf', required: true },
  { name: 'rg', label: 'RG', section: 'pessoais', type: 'text', required: true },
  { name: 'rgOrgao', label: 'Órgão emissor do RG', section: 'pessoais', type: 'text', required: true },
  { name: 'birthDate', label: 'Data de nascimento', section: 'pessoais', type: 'date', required: true },
  { name: 'sexo', label: 'Sexo', section: 'pessoais', type: 'select', options: ['Feminino', 'Masculino', 'Outro', 'Prefiro não informar'], required: true },
  { name: 'estadoCivil', label: 'Estado civil', section: 'pessoais', type: 'select', options: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'], required: true },
  { name: 'nacionalidade', label: 'Nacionalidade', section: 'pessoais', type: 'text', required: true },
  { name: 'naturalidade', label: 'Naturalidade (cidade/UF)', section: 'pessoais', type: 'text', required: true },

  // Contato
  { name: 'email', label: 'E-mail', section: 'contato', type: 'email', required: true },
  { name: 'phone', label: 'Celular', section: 'contato', type: 'phone', required: true },

  // Endereço
  { name: 'cep', label: 'CEP', section: 'endereco', type: 'cep', required: true },
  { name: 'logradouro', label: 'Logradouro', section: 'endereco', type: 'text', required: true },
  { name: 'numero', label: 'Número', section: 'endereco', type: 'text', required: true },
  { name: 'complemento', label: 'Complemento', section: 'endereco', type: 'text', required: false },
  { name: 'bairro', label: 'Bairro', section: 'endereco', type: 'text', required: true },
  { name: 'cidade', label: 'Cidade', section: 'endereco', type: 'text', required: true },
  { name: 'uf', label: 'UF', section: 'endereco', type: 'text', required: true },

  // Acadêmico
  { name: 'course', label: 'Curso', section: 'academico', type: 'select', options: ['Enfermagem', 'Administração', 'Direito', 'Pedagogia'], required: true },
  { name: 'shift', label: 'Turno', section: 'academico', type: 'select', options: ['manhã', 'tarde', 'noite'], required: true },
  { name: 'unit', label: 'Unidade', section: 'academico', type: 'select', options: ['Centro', 'Norte', 'Sul'], required: true },
  { name: 'modalidade', label: 'Modalidade', section: 'academico', type: 'select', options: ['Presencial', 'Semipresencial', 'EAD'], required: true },
  { name: 'ingresso', label: 'Forma de ingresso', section: 'academico', type: 'select', options: ['Vestibular', 'ENEM', 'Transferência', 'Segunda graduação'], required: true },
  { name: 'periodoLetivo', label: 'Período letivo de ingresso', section: 'academico', type: 'text', required: true },

  // Escolaridade anterior
  { name: 'escolaAnterior', label: 'Escola de ensino médio', section: 'escolaridade', type: 'text', required: true },
  { name: 'anoConclusao', label: 'Ano de conclusão do ensino médio', section: 'escolaridade', type: 'text', required: true },

  // Responsável (obrigatório só se o aluno for menor de 18)
  { name: 'respNome', label: 'Nome do responsável', section: 'responsavel', type: 'text', required: false, requiredIf: 'menor_de_idade' },
  { name: 'respCpf', label: 'CPF do responsável', section: 'responsavel', type: 'cpf', required: false, requiredIf: 'menor_de_idade' },
  { name: 'respParentesco', label: 'Parentesco', section: 'responsavel', type: 'text', required: false, requiredIf: 'menor_de_idade' },
  { name: 'respTelefone', label: 'Telefone do responsável', section: 'responsavel', type: 'phone', required: false, requiredIf: 'menor_de_idade' },

  // Pagamento (taxa de matrícula — simulada por enquanto)
  { name: 'paymentMethod', label: 'Forma de pagamento', section: 'pagamento', type: 'select', options: ['PIX', 'Cartão de crédito', 'Boleto'], required: true },
];

/** Valor da taxa de matrícula (demo). Vira configurável por escola depois. */
export const DEFAULT_ENROLLMENT_FEE = 150.0;

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Valida os dados coletados contra a lista de campos.
 * Trata os condicionais (responsável obrigatório se menor de idade) e os
 * tipos com regra própria (CPF, e-mail, data, select).
 */
export function validateEnrollment(
  fields: EnrollmentField[],
  data: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const idade = data.birthDate ? calcAge(String(data.birthDate)) : null;
  const menor = idade !== null && idade < 18;

  for (const f of fields) {
    const obrigatorio = f.required || (f.requiredIf === 'menor_de_idade' && menor);
    const val = (data[f.name] ?? '').toString().trim();

    if (obrigatorio && !val) {
      errors.push({ field: f.name, message: `"${f.label}" é obrigatório.` });
      continue;
    }
    if (!val) continue; // opcional em branco: ok

    if (f.type === 'cpf' && !isValidCpf(val)) {
      errors.push({ field: f.name, message: `CPF inválido em "${f.label}".` });
    } else if (f.type === 'email' && !isValidEmail(val)) {
      errors.push({ field: f.name, message: `E-mail inválido em "${f.label}".` });
    } else if (f.type === 'date' && calcAge(val) === null) {
      errors.push({ field: f.name, message: `Data inválida em "${f.label}".` });
    } else if (f.type === 'select' && f.options && !f.options.includes(val)) {
      errors.push({ field: f.name, message: `"${f.label}" deve ser um de: ${f.options.join(', ')}.` });
    }
  }
  return errors;
}
