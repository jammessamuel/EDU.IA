export const INSTITUTION_INFO = {
  nome: 'Faculdade Demo EDU.IA',
  atendimento: {
    horario: 'Segunda a sexta, das 8h às 21h. Sábado, das 8h às 13h.',
    secretaria: 'Atendimento presencial e online dentro do horário de funcionamento.',
    observacao: 'Domingos e feriados: sem atendimento presencial.',
  },
  localizacoes: [
    {
      unidade: 'Centro',
      endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      referencia: 'Próximo ao metrô Trianon-Masp/Brigadeiro.',
      maps: 'https://maps.google.com/?q=Av.+Paulista,+1000,+São+Paulo',
    },
    {
      unidade: 'Norte',
      endereco: 'Av. Cruzeiro do Sul, 1800 - Santana, São Paulo - SP',
      referencia: 'Próximo ao metrô Santana.',
      maps: 'https://maps.google.com/?q=Av.+Cruzeiro+do+Sul,+1800,+São+Paulo',
    },
    {
      unidade: 'Sul',
      endereco: 'Av. Santo Amaro, 2500 - Moema, São Paulo - SP',
      referencia: 'Acesso por corredores de ônibus da Av. Santo Amaro.',
      maps: 'https://maps.google.com/?q=Av.+Santo+Amaro,+2500,+São+Paulo',
    },
  ],
  conducao: [
    'Unidade Centro: metrô Trianon-Masp ou Brigadeiro; ônibus pela Av. Paulista.',
    'Unidade Norte: metrô Santana; ônibus pelos corredores da Cruzeiro do Sul.',
    'Unidade Sul: ônibus pela Av. Santo Amaro e acesso por estações próximas da linha Lilás.',
    'Para visita presencial, recomende confirmar a unidade escolhida antes de sair de casa.',
  ],
  descontos: {
    vista:
      'Condição comercial demo: pagamento à vista pode liberar até 15% de desconto, conforme campanha vigente e curso escolhido.',
    matricula:
      'Taxa de matrícula demo: R$ 150,00. O pagamento real ainda não está conectado a gateway nesta versão.',
    regra:
      'Não prometa bolsa definitiva. Sempre diga que a condição é confirmada na finalização da matrícula.',
  },
  materiais: [
    {
      curso: 'Enfermagem',
      arquivo: '/materiais/curso-enfermagem.pdf',
      resumo: 'Área da saúde, aulas práticas, empregabilidade e desconto para pagamento à vista.',
    },
    {
      curso: 'Direito',
      arquivo: '/materiais/curso-direito.pdf',
      resumo: 'Formação jurídica, prática simulada, carreira pública/privada e condição à vista.',
    },
    {
      curso: 'Administração',
      arquivo: '/materiais/curso-administracao.pdf',
      resumo: 'Gestão, negócios, empreendedorismo, mercado corporativo e desconto à vista.',
    },
  ],
};

export function institutionInfoForPrompt(frontendUrl?: string | null) {
  const base = (frontendUrl || '').replace(/\/$/, '');
  const materiais = INSTITUTION_INFO.materiais
    .map((m) => `- ${m.curso}: ${base}${m.arquivo} (${m.resumo})`)
    .join('\n');
  const locais = INSTITUTION_INFO.localizacoes
    .map((l) => `- ${l.unidade}: ${l.endereco}. Referência: ${l.referencia}. Mapa: ${l.maps}`)
    .join('\n');

  return `INFORMAÇÕES INSTITUCIONAIS:
- Nome: ${INSTITUTION_INFO.nome}
- Horário de funcionamento: ${INSTITUTION_INFO.atendimento.horario}
- Secretaria: ${INSTITUTION_INFO.atendimento.secretaria}
- Observação: ${INSTITUTION_INFO.atendimento.observacao}
- Desconto à vista: ${INSTITUTION_INFO.descontos.vista}
- Taxa de matrícula: ${INSTITUTION_INFO.descontos.matricula}
- Regra comercial: ${INSTITUTION_INFO.descontos.regra}

Localização:
${locais}

Condução/transporte:
${INSTITUTION_INFO.conducao.map((item) => `- ${item}`).join('\n')}

PDFs de cursos que você pode mandar quando o aluno pedir material, valores, cursos ou desconto:
${materiais}`;
}
