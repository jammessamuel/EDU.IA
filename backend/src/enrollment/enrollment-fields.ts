// ============================================================
// enrollment-fields.ts — definição dos campos da matrícula completa.
// Organizados em SEÇÕES (como uma ficha de matrícula presencial).
// Estes campos alimentam: a validação, o prompt da IA (Fase 2) e o PDF.
// Por enquanto são fixos p/ Educação; depois viram configuráveis por escola.
// ============================================================
import { isValidCpf, isValidEmail, calcAge, onlyDigits } from '../common/lib/validation';

export type FieldType = 'text' | 'select' | 'cpf' | 'email' | 'date' | 'cep' | 'phone' | 'document';
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
  requiredIf?: 'menor_de_idade' | 'brasileiro';
}

export type SupportedLanguage = 'Português' | 'English' | 'Español';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['Português', 'English', 'Español'];

export const IDENTITY_DOCUMENT_TYPES = [
  'CPF',
  'Passaporte',
  'SSN',
  'Driver License',
  'State ID',
  'NIE',
  'DNI',
  'Documento nacional',
  'Outro',
];

export const DOCUMENT_REQUIREMENTS = {
  brasil: [
    'CPF e RG/CNH ou documento oficial com foto',
    'Comprovante de residência',
    'Histórico ou certificado de conclusão do ensino médio',
    'Foto 3x4 quando a instituição solicitar',
  ],
  internacional: [
    'Passaporte ou documento nacional de identidade',
    'Visto, permissão de estudo ou comprovante de residência quando aplicável',
    'Histórico/diploma escolar, com tradução ou validação quando a instituição exigir',
    'Comprovante de endereço e contato de emergência',
  ],
};

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
  { name: 'preferredLanguage', label: 'Idioma preferido', section: 'pessoais', type: 'select', options: SUPPORTED_LANGUAGES, required: true },
  { name: 'countryOfResidence', label: 'País de residência', section: 'pessoais', type: 'text', required: true },
  { name: 'documentType', label: 'Tipo de documento', section: 'pessoais', type: 'select', options: IDENTITY_DOCUMENT_TYPES, required: true },
  { name: 'documentNumber', label: 'Número do documento', section: 'pessoais', type: 'document', required: true },
  { name: 'rg', label: 'RG ou documento complementar', section: 'pessoais', type: 'text', required: false, requiredIf: 'brasileiro' },
  { name: 'rgOrgao', label: 'Órgão emissor do RG', section: 'pessoais', type: 'text', required: false, requiredIf: 'brasileiro' },
  { name: 'birthDate', label: 'Data de nascimento', section: 'pessoais', type: 'date', required: true },
  { name: 'sexo', label: 'Sexo', section: 'pessoais', type: 'select', options: ['Feminino', 'Masculino', 'Outro', 'Prefiro não informar'], required: true },
  { name: 'estadoCivil', label: 'Estado civil', section: 'pessoais', type: 'select', options: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'], required: true },
  { name: 'nacionalidade', label: 'Nacionalidade', section: 'pessoais', type: 'text', required: true },
  { name: 'naturalidade', label: 'Naturalidade (cidade/estado/país)', section: 'pessoais', type: 'text', required: true },

  // Contato
  { name: 'email', label: 'E-mail', section: 'contato', type: 'email', required: true },
  { name: 'phone', label: 'Celular', section: 'contato', type: 'phone', required: true },

  // Endereço
  { name: 'cep', label: 'CEP / ZIP / código postal', section: 'endereco', type: 'cep', required: true },
  { name: 'logradouro', label: 'Logradouro', section: 'endereco', type: 'text', required: true },
  { name: 'numero', label: 'Número', section: 'endereco', type: 'text', required: true },
  { name: 'complemento', label: 'Complemento', section: 'endereco', type: 'text', required: false },
  { name: 'bairro', label: 'Bairro', section: 'endereco', type: 'text', required: true },
  { name: 'cidade', label: 'Cidade', section: 'endereco', type: 'text', required: true },
  { name: 'uf', label: 'UF / Estado / Província', section: 'endereco', type: 'text', required: true },

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

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const SELECT_ALIASES: Record<string, Record<string, string>> = {
  preferredLanguage: {
    portugues: 'Português',
    portuguese: 'Português',
    pt: 'Português',
    ptbr: 'Português',
    english: 'English',
    ingles: 'English',
    en: 'English',
    spanish: 'Español',
    espanhol: 'Español',
    espanol: 'Español',
    espanolcastellano: 'Español',
    es: 'Español',
  },
  documentType: {
    cpf: 'CPF',
    passaporte: 'Passaporte',
    passport: 'Passaporte',
    pasaporte: 'Passaporte',
    ssn: 'SSN',
    socialsecurity: 'SSN',
    socialsecuritynumber: 'SSN',
    driverslicense: 'Driver License',
    driverlicense: 'Driver License',
    carteira: 'Driver License',
    cnh: 'Driver License',
    stateid: 'State ID',
    stateidentity: 'State ID',
    nie: 'NIE',
    dni: 'DNI',
    nationalid: 'Documento nacional',
    nationalidentity: 'Documento nacional',
    documentonacional: 'Documento nacional',
    identitydocument: 'Documento nacional',
    documentoidentidade: 'Documento nacional',
    outro: 'Outro',
    other: 'Outro',
    otro: 'Outro',
  },
  sexo: {
    f: 'Feminino',
    fem: 'Feminino',
    feminino: 'Feminino',
    m: 'Masculino',
    masc: 'Masculino',
    masculino: 'Masculino',
    homem: 'Masculino',
    male: 'Masculino',
    hombre: 'Masculino',
    mulher: 'Feminino',
    female: 'Feminino',
    mujer: 'Feminino',
    outro: 'Outro',
    other: 'Outro',
    otro: 'Outro',
    prefironaoinformar: 'Prefiro não informar',
    naoinformar: 'Prefiro não informar',
    prefernottoanswer: 'Prefiro não informar',
    prefieronodecirlo: 'Prefiro não informar',
  },
  estadoCivil: {
    solteiro: 'Solteiro(a)',
    solteira: 'Solteiro(a)',
    solteiroa: 'Solteiro(a)',
    casado: 'Casado(a)',
    casada: 'Casado(a)',
    casadoa: 'Casado(a)',
    divorciado: 'Divorciado(a)',
    divorciada: 'Divorciado(a)',
    viuvo: 'Viúvo(a)',
    viuva: 'Viúvo(a)',
    uniaoestavel: 'União estável',
    single: 'Solteiro(a)',
    married: 'Casado(a)',
    divorced: 'Divorciado(a)',
    widowed: 'Viúvo(a)',
    soltero: 'Solteiro(a)',
    soltera: 'Solteiro(a)',
    viudo: 'Viúvo(a)',
    viuda: 'Viúvo(a)',
  },
  paymentMethod: {
    pix: 'PIX',
    cartao: 'Cartão de crédito',
    cartaocredito: 'Cartão de crédito',
    cartaodecredito: 'Cartão de crédito',
    credito: 'Cartão de crédito',
    boleto: 'Boleto',
  },
};

const FIELD_ALIASES: Record<string, string> = {
  nome: 'studentName',
  nomecompleto: 'studentName',
  aluno: 'studentName',
  student: 'studentName',
  fullname: 'studentName',
  fullName: 'studentName',
  language: 'preferredLanguage',
  idioma: 'preferredLanguage',
  idiomapreferido: 'preferredLanguage',
  preferredlanguage: 'preferredLanguage',
  pais: 'countryOfResidence',
  paisresidencia: 'countryOfResidence',
  paisderesidencia: 'countryOfResidence',
  country: 'countryOfResidence',
  residencecountry: 'countryOfResidence',
  countryofresidence: 'countryOfResidence',
  document: 'documentNumber',
  documento: 'documentNumber',
  numerodocumento: 'documentNumber',
  numerododocumento: 'documentNumber',
  documentnumber: 'documentNumber',
  passport: 'documentNumber',
  passaporte: 'documentNumber',
  pasaporte: 'documentNumber',
  ssn: 'documentNumber',
  nie: 'documentNumber',
  dni: 'documentNumber',
  cpf: 'documentNumber',
  cpfaluno: 'documentNumber',
  documenttype: 'documentType',
  tipodocumento: 'documentType',
  tipodedocumento: 'documentType',
  identitytype: 'documentType',
  registrogeral: 'rg',
  orgaoemissor: 'rgOrgao',
  orgaoemissorrg: 'rgOrgao',
  rgorgao: 'rgOrgao',
  rgemissor: 'rgOrgao',
  issuingagency: 'rgOrgao',
  issuer: 'rgOrgao',
  data: 'birthDate',
  nascimento: 'birthDate',
  datanascimento: 'birthDate',
  datadenascimento: 'birthDate',
  birthdate: 'birthDate',
  dateofbirth: 'birthDate',
  fechanacimiento: 'birthDate',
  gender: 'sexo',
  sex: 'sexo',
  estadocivil: 'estadoCivil',
  civilstate: 'estadoCivil',
  civilstatus: 'estadoCivil',
  maritalstatus: 'estadoCivil',
  nacionalidadealuno: 'nacionalidade',
  nationality: 'nacionalidade',
  nacionalidad: 'nacionalidade',
  cidadenatal: 'naturalidade',
  naturalidadeuf: 'naturalidade',
  birthplace: 'naturalidade',
  lugardenacimiento: 'naturalidade',
  telefone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  phone: 'phone',
  mobile: 'phone',
  zipcode: 'cep',
  zip: 'cep',
  postalcode: 'cep',
  codigopostal: 'cep',
  rua: 'logradouro',
  endereco: 'logradouro',
  address: 'logradouro',
  street: 'logradouro',
  direccion: 'logradouro',
  numeroendereco: 'numero',
  number: 'numero',
  estado: 'uf',
  state: 'uf',
  province: 'uf',
  provincia: 'uf',
  city: 'cidade',
  curso: 'course',
  cursodeinteresse: 'course',
  course: 'course',
  turno: 'shift',
  shift: 'shift',
  unidade: 'unit',
  campus: 'unit',
  formadeingresso: 'ingresso',
  admissiontype: 'ingresso',
  periodo: 'periodoLetivo',
  periodoletivoingresso: 'periodoLetivo',
  term: 'periodoLetivo',
  escola: 'escolaAnterior',
  escolaensinomedio: 'escolaAnterior',
  previousschool: 'escolaAnterior',
  highschool: 'escolaAnterior',
  anoconclusaoensinomedio: 'anoConclusao',
  graduationyear: 'anoConclusao',
  pagamento: 'paymentMethod',
  formapagamento: 'paymentMethod',
  formadepagamento: 'paymentMethod',
  payment: 'paymentMethod',
  paymentmethod: 'paymentMethod',
};

function canonicalFieldName(name: string): string {
  return FIELD_ALIASES[normalizeKey(name)] ?? name;
}

function normalizeSelectValue(field: EnrollmentField, value: string): string {
  const key = normalizeKey(value);
  const alias = SELECT_ALIASES[field.name]?.[key];
  if (alias) return alias;

  const option = field.options?.find((candidate) => {
    const optionKey = normalizeKey(candidate);
    return optionKey === key || optionKey.startsWith(key) || key.startsWith(optionKey);
  });
  return option ?? value.trim();
}

function inferDocumentTypeFromKey(key: string): string | null {
  if (key.includes('cpf')) return 'CPF';
  if (key.includes('passport') || key.includes('passaporte') || key.includes('pasaporte')) return 'Passaporte';
  if (key.includes('ssn') || key.includes('socialsecurity')) return 'SSN';
  if (key.includes('nie')) return 'NIE';
  if (key.includes('dni')) return 'DNI';
  if (key.includes('driver') || key.includes('cnh')) return 'Driver License';
  if (key.includes('stateid')) return 'State ID';
  return null;
}

function isBrazilianApplicant(data: Record<string, unknown>): boolean {
  const docType = normalizeKey(String(data.documentType ?? ''));
  const country = normalizeKey(String(data.countryOfResidence ?? ''));
  const nationality = normalizeKey(String(data.nacionalidade ?? ''));
  return (
    docType === 'cpf' ||
    country === 'brasil' ||
    country === 'brazil' ||
    nationality === 'brasileiro' ||
    nationality === 'brasileira' ||
    nationality === 'brazilian'
  );
}

export function isEnrollmentFieldRequired(field: EnrollmentField, data: Record<string, unknown>): boolean {
  const idade = data.birthDate ? calcAge(String(data.birthDate)) : null;
  const menor = idade !== null && idade < 18;
  if (field.required) return true;
  if (field.requiredIf === 'menor_de_idade') return menor;
  if (field.requiredIf === 'brasileiro') return isBrazilianApplicant(data);
  return false;
}

function validateIdentityDocument(type: string, value: string): string | null {
  const normalizedType = normalizeSelectValue(
    { name: 'documentType', label: 'Tipo de documento', section: 'pessoais', type: 'select', options: IDENTITY_DOCUMENT_TYPES, required: true },
    type,
  );
  const trimmed = value.trim().toUpperCase();
  const digits = onlyDigits(trimmed);

  if (normalizedType === 'CPF') {
    return isValidCpf(trimmed) ? null : 'CPF inválido em "Número do documento".';
  }

  if (normalizedType === 'SSN') {
    return digits.length === 9 ? null : 'SSN inválido: informe 9 dígitos.';
  }

  if (normalizedType === 'Passaporte') {
    return /^[A-Z0-9][A-Z0-9 -]{4,18}$/.test(trimmed)
      ? null
      : 'Passaporte inválido: use de 5 a 19 letras/números.';
  }

  if (normalizedType === 'NIE') {
    return /^[XYZ][0-9]{7}[A-Z]$/.test(trimmed.replace(/\s|-/g, ''))
      ? null
      : 'NIE inválido: use o formato espanhol, ex.: X1234567L.';
  }

  if (normalizedType === 'DNI') {
    return /^[0-9]{8}[A-Z]$/.test(trimmed.replace(/\s|-/g, ''))
      ? null
      : 'DNI inválido: use 8 números e 1 letra.';
  }

  return trimmed.length >= 4 ? null : 'Número do documento muito curto.';
}

export function normalizeEnrollmentData(
  fields: EnrollmentField[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const keyNorm = normalizeKey(key);
    const canonical = canonicalFieldName(key);
    normalized[canonical] = value;
    const inferredDocumentType = inferDocumentTypeFromKey(keyNorm);
    if (canonical === 'documentNumber' && inferredDocumentType && !normalized.documentType) {
      normalized.documentType = inferredDocumentType;
    }
  }

  const documentNumber = String(normalized.documentNumber ?? '').trim();
  if (documentNumber && !normalized.documentType && isValidCpf(documentNumber)) {
    normalized.documentType = 'CPF';
  }

  for (const field of fields) {
    const raw = normalized[field.name];
    if (raw == null) continue;

    const value = String(raw).trim();
    if (!value) continue;

    if (field.type === 'select') {
      normalized[field.name] = normalizeSelectValue(field, value);
    } else if (field.name === 'uf') {
      normalized[field.name] = value.length <= 3 ? value.toUpperCase() : value;
    } else if (field.type === 'email') {
      normalized[field.name] = value.toLowerCase();
    } else if (field.type === 'document') {
      normalized[field.name] = value.toUpperCase();
    } else {
      normalized[field.name] = value;
    }
  }

  if (String(normalized.documentType ?? '') === 'CPF' && normalized.documentNumber) {
    normalized.cpf = onlyDigits(String(normalized.documentNumber));
  }

  return normalized;
}

/**
 * Valida os dados coletados contra a lista de campos.
 * Trata os condicionais (responsável obrigatório se menor de idade) e os
 * tipos com regra própria (CPF, e-mail, data, select).
 */
export function validateEnrollment(
  fields: EnrollmentField[],
  data: Record<string, unknown>,
  opts: { requireMissing?: boolean } = {},
): ValidationError[] {
  const errors: ValidationError[] = [];
  const requireMissing = opts.requireMissing ?? true;

  for (const f of fields) {
    const obrigatorio = isEnrollmentFieldRequired(f, data);
    const val = (data[f.name] ?? '').toString().trim();

    if (requireMissing && obrigatorio && !val) {
      errors.push({ field: f.name, message: `"${f.label}" é obrigatório.` });
      continue;
    }
    if (!val) continue; // opcional em branco: ok

    if (f.type === 'cpf' && !isValidCpf(val)) {
      errors.push({ field: f.name, message: `CPF inválido em "${f.label}".` });
    } else if (f.type === 'document') {
      const docError = validateIdentityDocument(String(data.documentType ?? ''), val);
      if (docError) errors.push({ field: f.name, message: docError });
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
