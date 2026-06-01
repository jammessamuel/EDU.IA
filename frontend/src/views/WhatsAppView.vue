<script setup lang="ts">
import { ref, computed, reactive, nextTick, onMounted, watch } from 'vue'
import AppNav from '@/components/layout/AppNav.vue'
import QuickReplies from '@/components/chat/QuickReplies.vue'
import { simulatorApi } from '@/api/simulator'
import { useSimulatorStore } from '@/stores/simulator'
import { useWorkspaceStore } from '@/stores/workspace'

const store = useSimulatorStore()
const ws    = useWorkspaceStore()
onMounted(() => { store.fetchLeads(); ws.load() })

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Msg { id: string; from: 'ai' | 'user'; text: string; ts: Date }

interface ContactLead {
  name:   string
  data:   Record<string, string>
  status: string
}

interface ContactDef {
  id:      string
  phone:   string
  city:    string
  lead:    ContactLead | null
  history: { from: 'ai' | 'user'; text: string; minutesAgo: number }[]
}

interface ConvState {
  messages:  Msg[]
  isTyping:  boolean
  isSending: boolean
  lead:      ContactLead | null
}

// ─── Conversas por vertical ───────────────────────────────────────────────────

const CONTACTS_BY_VERTICAL: Record<string, ContactDef[]> = {

  // ── EDUCAÇÃO ──────────────────────────────────────────────────────────────
  education: [
    {
      id: 'c1', phone: '+55 (11) 99234-5678', city: 'São Paulo',
      lead: { name: 'Camila Souza', data: { course: 'Enfermagem', unit: 'Centro', shift: 'manhã' }, status: 'NOVO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Seja bem-vindo à nossa instituição. Como posso te ajudar?', minutesAgo: 47 },
        { from: 'user', text: 'Oi! Quero saber sobre os cursos de saúde', minutesAgo: 46 },
        { from: 'ai',   text: 'Que ótimo! Temos o curso de Enfermagem 🩺, muito valorizado no mercado. Qual curso te interessa? Temos: Enfermagem, Administração, Direito e Pedagogia.', minutesAgo: 45 },
        { from: 'user', text: 'Enfermagem mesmo', minutesAgo: 44 },
        { from: 'ai',   text: 'Perfeito! Temos unidades no Centro, Norte e Sul. Qual fica mais perto de você?', minutesAgo: 43 },
        { from: 'user', text: 'Centro, fica perto do meu trabalho', minutesAgo: 42 },
        { from: 'ai',   text: 'Ótimo! E qual turno você prefere: manhã, tarde ou noite?', minutesAgo: 41 },
        { from: 'user', text: 'Manhã', minutesAgo: 40 },
        { from: 'ai',   text: 'Qual é o seu nome completo para eu registrar?', minutesAgo: 39 },
        { from: 'user', text: 'Camila Souza', minutesAgo: 38 },
        { from: 'ai',   text: 'Pronto, Camila! ✅ Seus dados foram registrados. Um consultor vai te contatar em breve com mais informações sobre Enfermagem, unidade Centro, turno manhã. 😊', minutesAgo: 37 },
      ],
    },
    {
      id: 'c2', phone: '+55 (21) 97654-3210', city: 'Rio de Janeiro',
      lead: { name: 'Lucas Rodrigues', data: { course: 'Direito', unit: 'Sul', shift: 'tarde' }, status: 'CONTATO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar hoje?', minutesAgo: 130 },
        { from: 'user', text: 'Tenho interesse em fazer Direito', minutesAgo: 128 },
        { from: 'ai',   text: 'Excelente escolha! ⚖️ Nosso curso de Direito tem ótima reputação. Qual unidade você prefere: Centro, Norte ou Sul?', minutesAgo: 127 },
        { from: 'user', text: 'Sul', minutesAgo: 125 },
        { from: 'ai',   text: 'Qual turno: manhã, tarde ou noite?', minutesAgo: 124 },
        { from: 'user', text: 'Tarde', minutesAgo: 123 },
        { from: 'ai',   text: 'Qual é o seu nome completo?', minutesAgo: 122 },
        { from: 'user', text: 'Lucas Rodrigues', minutesAgo: 121 },
        { from: 'ai',   text: 'Obrigado, Lucas! ✅ Registrado. Nossa equipe vai entrar em contato em breve. 😊', minutesAgo: 120 },
        { from: 'user', text: 'Já falei com o consultor, adorei as opções!', minutesAgo: 30 },
        { from: 'ai',   text: 'Que ótimo, Lucas! Qualquer dúvida pode falar aqui. Boa sorte! 🎓', minutesAgo: 29 },
      ],
    },
    {
      id: 'c3', phone: '+55 (31) 98123-4567', city: 'Belo Horizonte',
      lead: { name: 'Mariana Costa', data: { course: 'Administração', unit: 'Sul', shift: 'tarde' }, status: 'INSCRITO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 300 },
        { from: 'user', text: 'Quero me inscrever em Administração', minutesAgo: 298 },
        { from: 'ai',   text: '📊 Administração é uma das carreiras mais versáteis! Qual unidade prefere: Centro, Norte ou Sul?', minutesAgo: 297 },
        { from: 'user', text: 'Sul', minutesAgo: 295 },
        { from: 'ai',   text: 'Turno: manhã, tarde ou noite?', minutesAgo: 294 },
        { from: 'user', text: 'Tarde', minutesAgo: 293 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 292 },
        { from: 'user', text: 'Mariana Costa', minutesAgo: 290 },
        { from: 'ai',   text: 'Tudo registrado, Mariana! ✅ Nosso time entra em contato em breve. 😊', minutesAgo: 288 },
        { from: 'user', text: 'Já me inscrevi! Começo semana que vem 🎉', minutesAgo: 60 },
        { from: 'ai',   text: 'Parabéns, Mariana! 🎉 Boas-vindas à família! Qualquer dúvida estou aqui.', minutesAgo: 59 },
      ],
    },
    {
      id: 'c4', phone: '+55 (41) 99876-5432', city: 'Curitiba',
      lead: { name: 'Thiago Martins', data: { course: 'Enfermagem', unit: 'Sul', shift: 'tarde' }, status: 'MATRICULADO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 600 },
        { from: 'user', text: 'Boa tarde! Informações sobre Enfermagem', minutesAgo: 598 },
        { from: 'ai',   text: 'Boa tarde! 🩺 Nosso curso de Enfermagem é excelente. Qual unidade: Centro, Norte ou Sul?', minutesAgo: 597 },
        { from: 'user', text: 'Sul por favor', minutesAgo: 595 },
        { from: 'ai',   text: 'Turno preferido?', minutesAgo: 594 },
        { from: 'user', text: 'Tarde', minutesAgo: 592 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 591 },
        { from: 'user', text: 'Thiago Martins', minutesAgo: 590 },
        { from: 'ai',   text: 'Registrado, Thiago! ✅ Um consultor vai te contatar. 😊', minutesAgo: 588 },
        { from: 'user', text: 'Já fiz a matrícula! Começo no próximo semestre 🎓', minutesAgo: 120 },
        { from: 'ai',   text: 'Que notícia incrível, Thiago! 🎓🎉 Seja bem-vindo! Bons estudos!', minutesAgo: 119 },
        { from: 'user', text: 'Obrigado pelo atendimento rápido! 👏', minutesAgo: 118 },
        { from: 'ai',   text: 'Foi um prazer! Qualquer dúvida, estamos aqui. Até breve! 📚', minutesAgo: 117 },
      ],
    },
    {
      id: 'c5', phone: '+55 (85) 98421-1234', city: 'Fortaleza',
      lead: null,
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar hoje?', minutesAgo: 3 },
        { from: 'user', text: 'Oi, quero informação sobre Pedagogia', minutesAgo: 2 },
        { from: 'ai',   text: '👩‍🏫 Pedagogia forma educadores incríveis! Qual unidade fica melhor pra você: Centro, Norte ou Sul?', minutesAgo: 1 },
      ],
    },
  ],

  // ── ADVOCACIA ─────────────────────────────────────────────────────────────
  legal: [
    {
      id: 'c1', phone: '+55 (11) 99234-5678', city: 'São Paulo',
      lead: { name: 'Roberto Alves', data: { area_direito: 'Trabalhista', tipo_caso: 'Demissão sem justa causa', cidade: 'São Paulo', urgencia: 'Normal' }, status: 'NOVO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Sou o assistente virtual do escritório. Como posso te ajudar hoje?', minutesAgo: 50 },
        { from: 'user', text: 'Fui demitido sem justa causa e acho que meus direitos não foram respeitados', minutesAgo: 48 },
        { from: 'ai',   text: 'Lamento pelo ocorrido. Podemos analisar seu caso com atenção. Para começar, qual área do Direito melhor descreve sua situação: Trabalhista, Civil, Criminal, Empresarial, Família ou Previdenciário?', minutesAgo: 47 },
        { from: 'user', text: 'Trabalhista, com certeza', minutesAgo: 46 },
        { from: 'ai',   text: 'Entendido. Pode descrever brevemente o que aconteceu? (não precisa de detalhes jurídicos, apenas o contexto geral)', minutesAgo: 45 },
        { from: 'user', text: 'Demissão sem justa causa, mas não recebi horas extras e o FGTS não foi depositado corretamente', minutesAgo: 44 },
        { from: 'ai',   text: 'Importante. Em qual cidade/estado você está?', minutesAgo: 43 },
        { from: 'user', text: 'São Paulo, capital', minutesAgo: 42 },
        { from: 'ai',   text: 'Qual o nível de urgência: Urgente (prazo judicial), Normal ou Sem pressa?', minutesAgo: 41 },
        { from: 'user', text: 'Normal, mas quero resolver logo', minutesAgo: 40 },
        { from: 'ai',   text: 'Qual é o seu nome completo?', minutesAgo: 39 },
        { from: 'user', text: 'Roberto Alves', minutesAgo: 38 },
        { from: 'ai',   text: 'Obrigado, Roberto! ✅ Caso registrado. Um advogado trabalhista vai analisar sua situação e entrar em contato em breve. Não tome nenhuma ação jurídica sem orientação. ⚖️', minutesAgo: 37 },
      ],
    },
    {
      id: 'c2', phone: '+55 (21) 97654-3210', city: 'Rio de Janeiro',
      lead: { name: 'Marcia Souza', data: { area_direito: 'Família', tipo_caso: 'Divórcio consensual', cidade: 'Rio de Janeiro', urgencia: 'Normal' }, status: 'ANALISE' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 180 },
        { from: 'user', text: 'Preciso de ajuda para fazer um divórcio', minutesAgo: 178 },
        { from: 'ai',   text: 'Entendo. Qual área do Direito: Trabalhista, Civil, Criminal, Empresarial, Família ou Previdenciário?', minutesAgo: 177 },
        { from: 'user', text: 'Família, é um divórcio consensual', minutesAgo: 176 },
        { from: 'ai',   text: 'Pode descrever brevemente a situação?', minutesAgo: 175 },
        { from: 'user', text: 'Divórcio consensual, temos dois filhos e precisamos definir guarda e partilha de bens', minutesAgo: 174 },
        { from: 'ai',   text: 'Sua cidade/estado?', minutesAgo: 173 },
        { from: 'user', text: 'Rio de Janeiro', minutesAgo: 172 },
        { from: 'ai',   text: 'Nível de urgência?', minutesAgo: 171 },
        { from: 'user', text: 'Normal, estamos em processo amigável', minutesAgo: 170 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 169 },
        { from: 'user', text: 'Marcia Souza', minutesAgo: 168 },
        { from: 'ai',   text: 'Registrado, Marcia! ✅ Nossa equipe de Direito de Família vai analisar e entrar em contato. ⚖️', minutesAgo: 167 },
        { from: 'user', text: 'O advogado já me ligou e estamos analisando o caso juntos', minutesAgo: 40 },
        { from: 'ai',   text: 'Ótimo, Marcia! Qualquer dúvida pode falar aqui. Cuide-se! 💙', minutesAgo: 39 },
      ],
    },
    {
      id: 'c3', phone: '+55 (31) 98123-4567', city: 'Belo Horizonte',
      lead: { name: 'Paulo Gomes', data: { area_direito: 'Civil', tipo_caso: 'Cobrança indevida de banco', cidade: 'Belo Horizonte', urgencia: 'Normal' }, status: 'PROPOSTA' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 400 },
        { from: 'user', text: 'Estou sendo cobrado indevidamente pelo meu banco', minutesAgo: 398 },
        { from: 'ai',   text: 'Área do Direito: Trabalhista, Civil, Criminal, Empresarial, Família ou Previdenciário?', minutesAgo: 397 },
        { from: 'user', text: 'Civil', minutesAgo: 396 },
        { from: 'ai',   text: 'Descreva brevemente o caso:', minutesAgo: 395 },
        { from: 'user', text: 'Cobrança indevida de tarifas bancárias há 3 anos, já solicitei estorno mas negaram', minutesAgo: 394 },
        { from: 'ai',   text: 'Sua cidade?', minutesAgo: 393 },
        { from: 'user', text: 'Belo Horizonte', minutesAgo: 392 },
        { from: 'ai',   text: 'Urgência do caso?', minutesAgo: 391 },
        { from: 'user', text: 'Normal', minutesAgo: 390 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 389 },
        { from: 'user', text: 'Paulo Gomes', minutesAgo: 388 },
        { from: 'ai',   text: 'Registrado, Paulo! ✅ Nosso advogado civilista vai analisar. Casos de cobrança indevida têm boas chances de ressarcimento! ⚖️', minutesAgo: 387 },
        { from: 'user', text: 'Recebi a proposta de honorários, vou assinar hoje!', minutesAgo: 20 },
        { from: 'ai',   text: 'Ótima decisão, Paulo! Pode contar com nosso escritório. 💪', minutesAgo: 19 },
      ],
    },
    {
      id: 'c4', phone: '+55 (41) 99876-5432', city: 'Curitiba',
      lead: { name: 'Eduardo Nunes', data: { area_direito: 'Criminal', tipo_caso: 'Defesa em processo criminal', cidade: 'Curitiba', urgencia: 'Urgente (prazo judicial)' }, status: 'CONTRATADO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 700 },
        { from: 'user', text: 'URGENTE — tenho audiência amanhã e preciso de um advogado criminal', minutesAgo: 698 },
        { from: 'ai',   text: 'Entendido, vamos agilizar! Área do Direito?', minutesAgo: 697 },
        { from: 'user', text: 'Criminal', minutesAgo: 696 },
        { from: 'ai',   text: 'Descreva o caso brevemente:', minutesAgo: 695 },
        { from: 'user', text: 'Processo por suposta lesão corporal, sou inocente e não tenho advogado', minutesAgo: 694 },
        { from: 'ai',   text: 'Sua cidade?', minutesAgo: 693 },
        { from: 'user', text: 'Curitiba', minutesAgo: 692 },
        { from: 'ai',   text: 'Urgência?', minutesAgo: 691 },
        { from: 'user', text: 'Urgente (prazo judicial) — audiência amanhã às 14h', minutesAgo: 690 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 689 },
        { from: 'user', text: 'Eduardo Nunes', minutesAgo: 688 },
        { from: 'ai',   text: 'Eduardo, ✅ caso registrado com PRIORIDADE URGENTE. Um criminalista vai te ligar nos próximos minutos. Não fale nada sem orientação jurídica! ⚖️🚨', minutesAgo: 687 },
        { from: 'user', text: 'O advogado me ligou, fiz o contrato e ele vai na audiência amanhã. Salvou minha vida!', minutesAgo: 200 },
        { from: 'ai',   text: 'Que bom, Eduardo! Pode ficar tranquilo, está em boas mãos. Torço pelo melhor resultado! 🙏', minutesAgo: 199 },
      ],
    },
    {
      id: 'c5', phone: '+55 (85) 98421-1234', city: 'Fortaleza',
      lead: null,
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 4 },
        { from: 'user', text: 'Preciso de ajuda com uma questão de herança', minutesAgo: 3 },
        { from: 'ai',   text: 'Entendo. Qual área do Direito melhor descreve: Trabalhista, Civil, Criminal, Empresarial, Família ou Previdenciário?', minutesAgo: 2 },
        { from: 'user', text: 'Família, é sobre herança do meu pai', minutesAgo: 1 },
        { from: 'ai',   text: 'Lamento pela perda. Para que possamos ajudar melhor, pode descrever brevemente a situação?', minutesAgo: 0 },
      ],
    },
  ],

  // ── IMOBILIÁRIA ───────────────────────────────────────────────────────────
  'real-estate': [
    {
      id: 'c1', phone: '+55 (11) 99234-5678', city: 'São Paulo',
      lead: { name: 'Thiago Barbosa', data: { interesse: 'Comprar', tipo_imovel: 'Apartamento', localizacao: 'Moema, SP', faixa_preco: 'R$600k–1M' }, status: 'NOVO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Sou o assistente da imobiliária. Como posso te ajudar?', minutesAgo: 55 },
        { from: 'user', text: 'Quero comprar um apartamento em São Paulo', minutesAgo: 53 },
        { from: 'ai',   text: 'Ótimo! Você quer Comprar, Alugar, ou está aberto a Comprar ou Alugar?', minutesAgo: 52 },
        { from: 'user', text: 'Comprar mesmo', minutesAgo: 51 },
        { from: 'ai',   text: 'Que tipo de imóvel: Apartamento, Casa, Comercial, Terreno ou Rural?', minutesAgo: 50 },
        { from: 'user', text: 'Apartamento', minutesAgo: 49 },
        { from: 'ai',   text: 'Qual bairro ou região você prefere?', minutesAgo: 48 },
        { from: 'user', text: 'Moema, Ibirapuera ou Vila Nova Conceição', minutesAgo: 47 },
        { from: 'ai',   text: 'Qual a sua faixa de preço: Até R$300k, R$300k–600k, R$600k–1M ou Acima de R$1M?', minutesAgo: 46 },
        { from: 'user', text: 'Entre R$600k e R$1M', minutesAgo: 45 },
        { from: 'ai',   text: 'Qual é o seu nome completo?', minutesAgo: 44 },
        { from: 'user', text: 'Thiago Barbosa', minutesAgo: 43 },
        { from: 'ai',   text: 'Perfeito, Thiago! 🏠✅ Temos ótimas opções em Moema na sua faixa. Um corretor especializado nessa região vai entrar em contato. Que tal?', minutesAgo: 42 },
      ],
    },
    {
      id: 'c2', phone: '+55 (21) 97654-3210', city: 'Alphaville',
      lead: { name: 'Patricia Vargas', data: { interesse: 'Alugar', tipo_imovel: 'Casa', localizacao: 'Alphaville, SP', faixa_preco: 'R$300k–600k' }, status: 'INTERESSE' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 200 },
        { from: 'user', text: 'Procuro uma casa para alugar com jardim para meus filhos', minutesAgo: 198 },
        { from: 'ai',   text: 'Adorável! Você quer Comprar ou Alugar?', minutesAgo: 197 },
        { from: 'user', text: 'Alugar por enquanto', minutesAgo: 196 },
        { from: 'ai',   text: 'Tipo de imóvel?', minutesAgo: 195 },
        { from: 'user', text: 'Casa com quintal ou jardim', minutesAgo: 194 },
        { from: 'ai',   text: 'Qual região/bairro?', minutesAgo: 193 },
        { from: 'user', text: 'Alphaville ou Barueri, preciso de segurança para as crianças', minutesAgo: 192 },
        { from: 'ai',   text: 'Faixa de preço: Até R$300k, R$300k–600k, R$600k–1M ou Acima de R$1M?', minutesAgo: 191 },
        { from: 'user', text: 'R$300k a R$600k', minutesAgo: 190 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 189 },
        { from: 'user', text: 'Patricia Vargas', minutesAgo: 188 },
        { from: 'ai',   text: 'Que charme, Patricia! 🏡✅ Temos casas lindas em Alphaville com jardim. Uma corretora especializada na região vai te contatar. 😊', minutesAgo: 187 },
        { from: 'user', text: 'Já conversei com a corretora e adorei as opções! Vou visitar amanhã', minutesAgo: 50 },
        { from: 'ai',   text: 'Que ótimo, Patricia! 🎉 Espero que encontre a casa dos sonhos! Qualquer dúvida estamos aqui.', minutesAgo: 49 },
      ],
    },
    {
      id: 'c3', phone: '+55 (31) 98123-4567', city: 'Pinheiros',
      lead: { name: 'Bianca Monteiro', data: { interesse: 'Comprar ou Alugar', tipo_imovel: 'Apartamento', localizacao: 'Pinheiros, SP', faixa_preco: 'R$300k–600k' }, status: 'VISITA' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 350 },
        { from: 'user', text: 'Estou pesquisando apartamentos em Pinheiros', minutesAgo: 348 },
        { from: 'ai',   text: 'Ótima região! Você prefere Comprar, Alugar ou está aberto a ambos?', minutesAgo: 347 },
        { from: 'user', text: 'Depende da oferta, aberta a comprar ou alugar', minutesAgo: 346 },
        { from: 'ai',   text: 'Tipo de imóvel?', minutesAgo: 345 },
        { from: 'user', text: 'Apartamento, de 2 ou 3 quartos', minutesAgo: 344 },
        { from: 'ai',   text: 'Bairro preferido?', minutesAgo: 343 },
        { from: 'user', text: 'Pinheiros ou Vila Madalena', minutesAgo: 342 },
        { from: 'ai',   text: 'Faixa de preço?', minutesAgo: 341 },
        { from: 'user', text: 'Até R$600k', minutesAgo: 340 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 339 },
        { from: 'user', text: 'Bianca Monteiro', minutesAgo: 338 },
        { from: 'ai',   text: 'Perfeito, Bianca! 🏢✅ Temos opções incríveis em Pinheiros. Nosso corretor vai te contatar para agendar visitas. 😊', minutesAgo: 337 },
        { from: 'user', text: 'Visita agendada para sábado! Animada 🥳', minutesAgo: 30 },
        { from: 'ai',   text: 'Que bom, Bianca! Vai adorar os imóveis. Boa visita! 🏠✨', minutesAgo: 29 },
      ],
    },
    {
      id: 'c4', phone: '+55 (41) 99876-5432', city: 'Cotia',
      lead: { name: 'André Lacerda', data: { interesse: 'Comprar', tipo_imovel: 'Casa', localizacao: 'Cotia, SP', faixa_preco: 'R$600k–1M' }, status: 'FECHADO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 800 },
        { from: 'user', text: 'Quero comprar uma casa com piscina em Cotia', minutesAgo: 798 },
        { from: 'ai',   text: 'Que sonho! Você quer Comprar ou Alugar?', minutesAgo: 797 },
        { from: 'user', text: 'Comprar', minutesAgo: 796 },
        { from: 'ai',   text: 'Tipo de imóvel?', minutesAgo: 795 },
        { from: 'user', text: 'Casa com piscina e área verde', minutesAgo: 794 },
        { from: 'ai',   text: 'Localização/bairro?', minutesAgo: 793 },
        { from: 'user', text: 'Cotia, condomínio fechado se possível', minutesAgo: 792 },
        { from: 'ai',   text: 'Faixa de preço?', minutesAgo: 791 },
        { from: 'user', text: 'R$600k até R$1M', minutesAgo: 790 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 789 },
        { from: 'user', text: 'André Lacerda', minutesAgo: 788 },
        { from: 'ai',   text: 'Excelente, André! 🏡✅ Temos casas incríveis em condomínio em Cotia. Nosso corretor vai te contatar. 😊', minutesAgo: 787 },
        { from: 'user', text: 'FECHEI! Assino a escritura semana que vem! 🎉🏠', minutesAgo: 100 },
        { from: 'ai',   text: 'PARABÉNS, André!! 🎉🏠 Que conquista incrível! Muito feliz por você! Qualquer dúvida no processo, pode contar conosco.', minutesAgo: 99 },
        { from: 'user', text: 'Obrigado demais pelo atendimento! Recomendarei pra todo mundo 🙏', minutesAgo: 98 },
      ],
    },
    {
      id: 'c5', phone: '+55 (85) 98421-1234', city: 'Fortaleza',
      lead: null,
      history: [
        { from: 'ai',   text: 'Olá! 👋 Posso te ajudar a encontrar o imóvel ideal?', minutesAgo: 5 },
        { from: 'user', text: 'Oi! Quero alugar um apartamento em Fortaleza', minutesAgo: 3 },
        { from: 'ai',   text: 'Ótimo! Você prefere Comprar, Alugar, ou está aberto a Comprar ou Alugar?', minutesAgo: 2 },
        { from: 'user', text: 'Alugar por agora', minutesAgo: 1 },
        { from: 'ai',   text: 'Que tipo de imóvel você busca: Apartamento, Casa, Comercial, Terreno ou Rural?', minutesAgo: 0 },
      ],
    },
  ],

  // ── SAÚDE ─────────────────────────────────────────────────────────────────
  health: [
    {
      id: 'c1', phone: '+55 (11) 99234-5678', city: 'São Paulo',
      lead: { name: 'Camila Torres', data: { especialidade: 'Pediatria', tipo_atendimento: 'Consulta', convenio: 'Unimed', urgencia: 'Esta semana' }, status: 'NOVO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Sou o assistente da Clínica. Como posso te ajudar?', minutesAgo: 60 },
        { from: 'user', text: 'Preciso marcar uma consulta para minha filha de 4 anos', minutesAgo: 58 },
        { from: 'ai',   text: 'Com certeza! Qual especialidade você precisa: Clínica Geral, Pediatria, Ginecologia, Cardiologia, Dermatologia, Ortopedia, Psicologia, Nutrição ou Outra?', minutesAgo: 57 },
        { from: 'user', text: 'Pediatria', minutesAgo: 56 },
        { from: 'ai',   text: 'Que tipo de atendimento: Consulta, Exame, Retorno ou Procedimento?', minutesAgo: 55 },
        { from: 'user', text: 'Consulta mesmo', minutesAgo: 54 },
        { from: 'ai',   text: 'Qual convênio: Particular, Unimed, Bradesco Saúde, Amil, SulAmérica ou Outro?', minutesAgo: 53 },
        { from: 'user', text: 'Unimed', minutesAgo: 52 },
        { from: 'ai',   text: 'Qual a urgência: Urgente, Esta semana ou Sem urgência?', minutesAgo: 51 },
        { from: 'user', text: 'Esta semana está bom', minutesAgo: 50 },
        { from: 'ai',   text: 'Qual é o seu nome completo?', minutesAgo: 49 },
        { from: 'user', text: 'Camila Torres', minutesAgo: 48 },
        { from: 'ai',   text: 'Perfeito, Camila! 🏥✅ Consulta de Pediatria com Unimed registrada. Nossa equipe vai entrar em contato para confirmar horário. 😊', minutesAgo: 47 },
      ],
    },
    {
      id: 'c2', phone: '+55 (21) 97654-3210', city: 'Rio de Janeiro',
      lead: { name: 'Marcos Pereira', data: { especialidade: 'Cardiologia', tipo_atendimento: 'Exame', convenio: 'Bradesco Saúde', urgencia: 'Urgente' }, status: 'AGENDADO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 250 },
        { from: 'user', text: 'Estou sentindo dores no peito desde ontem, é urgente', minutesAgo: 248 },
        { from: 'ai',   text: 'Entendo a preocupação. Qual especialidade: Clínica Geral, Pediatria, Ginecologia, Cardiologia, Dermatologia, Ortopedia, Psicologia, Nutrição ou Outra?', minutesAgo: 247 },
        { from: 'user', text: 'Cardiologia', minutesAgo: 246 },
        { from: 'ai',   text: 'Tipo de atendimento?', minutesAgo: 245 },
        { from: 'user', text: 'Preciso fazer um exame de urgência', minutesAgo: 244 },
        { from: 'ai',   text: 'Convênio?', minutesAgo: 243 },
        { from: 'user', text: 'Bradesco Saúde', minutesAgo: 242 },
        { from: 'ai',   text: 'Urgência?', minutesAgo: 241 },
        { from: 'user', text: 'Urgente, tenho medo que seja algo sério', minutesAgo: 240 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 239 },
        { from: 'user', text: 'Marcos Pereira', minutesAgo: 238 },
        { from: 'ai',   text: 'Marcos, ✅ caso registrado como URGENTE em Cardiologia. Nossa equipe vai te ligar em breve. Se as dores piorarem, vá imediatamente a uma UPA. 🚨', minutesAgo: 237 },
        { from: 'user', text: 'Já fui e agendei o ecocardiograma para amanhã', minutesAgo: 60 },
        { from: 'ai',   text: 'Ótimo, Marcos! Cuide-se bastante. Estamos aqui se precisar. 💙', minutesAgo: 59 },
      ],
    },
    {
      id: 'c3', phone: '+55 (31) 98123-4567', city: 'Belo Horizonte',
      lead: { name: 'Vanessa Oliveira', data: { especialidade: 'Dermatologia', tipo_atendimento: 'Consulta', convenio: 'Particular', urgencia: 'Sem urgência' }, status: 'CONFIRMADO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 500 },
        { from: 'user', text: 'Quero consulta com dermatologista para avaliação de manchas na pele', minutesAgo: 498 },
        { from: 'ai',   text: 'Especialidade: Clínica Geral, Pediatria, Ginecologia, Cardiologia, Dermatologia, Ortopedia, Psicologia, Nutrição ou Outra?', minutesAgo: 497 },
        { from: 'user', text: 'Dermatologia', minutesAgo: 496 },
        { from: 'ai',   text: 'Tipo de atendimento?', minutesAgo: 495 },
        { from: 'user', text: 'Consulta', minutesAgo: 494 },
        { from: 'ai',   text: 'Convênio?', minutesAgo: 493 },
        { from: 'user', text: 'Particular', minutesAgo: 492 },
        { from: 'ai',   text: 'Urgência?', minutesAgo: 491 },
        { from: 'user', text: 'Sem urgência, quero avaliação preventiva', minutesAgo: 490 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 489 },
        { from: 'user', text: 'Vanessa Oliveira', minutesAgo: 488 },
        { from: 'ai',   text: 'Agendamento registrado, Vanessa! 🏥✅ Nossa dermatologista vai confirmar o horário. 😊', minutesAgo: 487 },
        { from: 'user', text: 'Horário confirmado! Quinta-feira às 15h 👍', minutesAgo: 40 },
        { from: 'ai',   text: 'Perfeito, Vanessa! Qualquer dúvida antes da consulta, estamos aqui. Até quinta! 😊', minutesAgo: 39 },
      ],
    },
    {
      id: 'c4', phone: '+55 (41) 99876-5432', city: 'Curitiba',
      lead: { name: 'Renato Cardoso', data: { especialidade: 'Ortopedia', tipo_atendimento: 'Procedimento', convenio: 'Amil', urgencia: 'Esta semana' }, status: 'ATENDIDO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 900 },
        { from: 'user', text: 'Tive uma queda e estou com dores no joelho', minutesAgo: 898 },
        { from: 'ai',   text: 'Especialidade?', minutesAgo: 897 },
        { from: 'user', text: 'Ortopedia', minutesAgo: 896 },
        { from: 'ai',   text: 'Tipo de atendimento?', minutesAgo: 895 },
        { from: 'user', text: 'Pode precisar de procedimento para ver se tem lesão', minutesAgo: 894 },
        { from: 'ai',   text: 'Convênio?', minutesAgo: 893 },
        { from: 'user', text: 'Amil', minutesAgo: 892 },
        { from: 'ai',   text: 'Urgência?', minutesAgo: 891 },
        { from: 'user', text: 'Esta semana, está inchado', minutesAgo: 890 },
        { from: 'ai',   text: 'Seu nome?', minutesAgo: 889 },
        { from: 'user', text: 'Renato Cardoso', minutesAgo: 888 },
        { from: 'ai',   text: 'Registrado, Renato! 🏥✅ Nosso ortopedista vai te contatar. Evite sobrecarregar o joelho enquanto isso. 🦿', minutesAgo: 887 },
        { from: 'user', text: 'Já fui atendido! Foi lesão no menisco, já estou em tratamento 🙏', minutesAgo: 100 },
        { from: 'ai',   text: 'Que bom que foi atendido rápido, Renato! Força na recuperação! 💪', minutesAgo: 99 },
      ],
    },
    {
      id: 'c5', phone: '+55 (85) 98421-1234', city: 'Fortaleza',
      lead: null,
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar hoje?', minutesAgo: 5 },
        { from: 'user', text: 'Quero marcar consulta de ginecologia', minutesAgo: 3 },
        { from: 'ai',   text: 'Que especialidade você precisa: Clínica Geral, Pediatria, Ginecologia, Cardiologia, Dermatologia, Ortopedia, Psicologia, Nutrição ou Outra?', minutesAgo: 2 },
        { from: 'user', text: 'Ginecologia', minutesAgo: 1 },
        { from: 'ai',   text: 'Que tipo de atendimento: Consulta, Exame, Retorno ou Procedimento?', minutesAgo: 0 },
      ],
    },
  ],

  // ── VENDAS ────────────────────────────────────────────────────────────────
  sales: [
    {
      id: 'c1', phone: '+55 (11) 99234-5678', city: 'São Paulo',
      lead: { name: 'Igor Sampaio', data: { produto_interesse: 'CRM Enterprise', orcamento: 'R$5k–20k', prazo_decisao: 'Este mês' }, status: 'NOVO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Sou o assistente de vendas. Como posso te ajudar?', minutesAgo: 65 },
        { from: 'user', text: 'Preciso de um CRM para minha equipe de vendas de 20 pessoas', minutesAgo: 63 },
        { from: 'ai',   text: 'Perfeito! Temos soluções corporativas excelentes. Qual produto ou serviço te interessa?', minutesAgo: 62 },
        { from: 'user', text: 'CRM Enterprise com automação de pipeline', minutesAgo: 61 },
        { from: 'ai',   text: 'Qual é a sua faixa de orçamento: Até R$1k, R$1k–5k, R$5k–20k, Acima de R$20k ou A definir?', minutesAgo: 60 },
        { from: 'user', text: 'Entre R$5k e R$20k por mês', minutesAgo: 59 },
        { from: 'ai',   text: 'Qual o prazo para decisão: Imediato, Esta semana, Este mês ou Sem prazo definido?', minutesAgo: 58 },
        { from: 'user', text: 'Este mês, estamos em processo de seleção', minutesAgo: 57 },
        { from: 'ai',   text: 'Qual é o seu nome completo?', minutesAgo: 56 },
        { from: 'user', text: 'Igor Sampaio', minutesAgo: 55 },
        { from: 'ai',   text: 'Ótimo, Igor! 🎯✅ Interesse registrado para CRM Enterprise. Um consultor especializado vai te contatar para uma demo personalizada para sua equipe. 🚀', minutesAgo: 54 },
      ],
    },
    {
      id: 'c2', phone: '+55 (21) 97654-3210', city: 'Rio de Janeiro',
      lead: { name: 'Leticia Azevedo', data: { produto_interesse: 'ERP Cloud', orcamento: 'Acima de R$20k', prazo_decisao: 'Imediato' }, status: 'INTERESSE' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 300 },
        { from: 'user', text: 'Nossa empresa precisa migrar para um ERP em nuvem URGENTE', minutesAgo: 298 },
        { from: 'ai',   text: 'Entendido! Qual produto/serviço te interessa?', minutesAgo: 297 },
        { from: 'user', text: 'ERP Cloud completo com módulos financeiro, RH e estoque', minutesAgo: 296 },
        { from: 'ai',   text: 'Faixa de orçamento?', minutesAgo: 295 },
        { from: 'user', text: 'Acima de R$20k, é uma empresa de 200 funcionários', minutesAgo: 294 },
        { from: 'ai',   text: 'Prazo para decisão?', minutesAgo: 293 },
        { from: 'user', text: 'Imediato, nosso sistema atual vai ser descontinuado', minutesAgo: 292 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 291 },
        { from: 'user', text: 'Leticia Azevedo', minutesAgo: 290 },
        { from: 'ai',   text: 'Leticia, ✅ caso registrado como PRIORIDADE. Um executivo de contas vai te contatar em até 2 horas. 🚀', minutesAgo: 289 },
        { from: 'user', text: 'O consultor já me ligou! Vamos fazer a demo amanhã 🙌', minutesAgo: 60 },
        { from: 'ai',   text: 'Excelente, Leticia! Vai adorar a solução. Qualquer dúvida antes da demo, pode perguntar! 💪', minutesAgo: 59 },
      ],
    },
    {
      id: 'c3', phone: '+55 (31) 98123-4567', city: 'Belo Horizonte',
      lead: { name: 'Gustavo Pinto', data: { produto_interesse: 'Automação de RH', orcamento: 'R$1k–5k', prazo_decisao: 'Esta semana' }, status: 'PROPOSTA' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 480 },
        { from: 'user', text: 'Quero automatizar os processos de RH da nossa empresa', minutesAgo: 478 },
        { from: 'ai',   text: 'Que produto/serviço te interessa?', minutesAgo: 477 },
        { from: 'user', text: 'Software de automação de RH — admissão, férias, folha', minutesAgo: 476 },
        { from: 'ai',   text: 'Orçamento disponível?', minutesAgo: 475 },
        { from: 'user', text: 'R$1k a R$5k mensais', minutesAgo: 474 },
        { from: 'ai',   text: 'Prazo para decisão?', minutesAgo: 473 },
        { from: 'user', text: 'Esta semana idealmente', minutesAgo: 472 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 471 },
        { from: 'user', text: 'Gustavo Pinto', minutesAgo: 470 },
        { from: 'ai',   text: '✅ Registrado, Gustavo! Um especialista em RH Tech vai te contatar com uma proposta customizada. 🎯', minutesAgo: 469 },
        { from: 'user', text: 'Proposta recebida! Estou analisando com o financeiro', minutesAgo: 30 },
        { from: 'ai',   text: 'Ótimo, Gustavo! Qualquer dúvida sobre a proposta, estamos aqui. 💼', minutesAgo: 29 },
      ],
    },
    {
      id: 'c4', phone: '+55 (41) 99876-5432', city: 'Curitiba',
      lead: { name: 'Felipe Corrêa', data: { produto_interesse: 'Chatbot IA para atendimento', orcamento: 'R$1k–5k', prazo_decisao: 'Imediato' }, status: 'FECHADO' },
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar?', minutesAgo: 1000 },
        { from: 'user', text: 'Preciso de um chatbot de IA para atendimento ao cliente', minutesAgo: 998 },
        { from: 'ai',   text: 'Excelente! Qual produto/serviço te interessa?', minutesAgo: 997 },
        { from: 'user', text: 'Chatbot com IA para WhatsApp, atendimento 24/7', minutesAgo: 996 },
        { from: 'ai',   text: 'Faixa de orçamento?', minutesAgo: 995 },
        { from: 'user', text: 'R$1k a R$5k mensais', minutesAgo: 994 },
        { from: 'ai',   text: 'Prazo para decidir?', minutesAgo: 993 },
        { from: 'user', text: 'Imediato, preciso implementar esse mês', minutesAgo: 992 },
        { from: 'ai',   text: 'Seu nome completo?', minutesAgo: 991 },
        { from: 'user', text: 'Felipe Corrêa', minutesAgo: 990 },
        { from: 'ai',   text: 'Felipe, ✅ perfeito! Um especialista em IA vai te apresentar uma demo do nosso chatbot. Vai transformar seu atendimento! 🤖🚀', minutesAgo: 989 },
        { from: 'user', text: 'JÁ FECHEI! Começo a implementação semana que vem 🎉🎉', minutesAgo: 150 },
        { from: 'ai',   text: 'ISSO, Felipe! 🎉🚀 Bem-vindo! Sua equipe vai adorar a automação. Qualquer dúvida na implementação, estamos aqui!', minutesAgo: 149 },
        { from: 'user', text: 'Atendimento de vocês foi incrível. 10/10 ⭐⭐⭐⭐⭐', minutesAgo: 148 },
        { from: 'ai',   text: 'Obrigado, Felipe! Isso nos motiva muito! 🙏 Sucesso no negócio!', minutesAgo: 147 },
      ],
    },
    {
      id: 'c5', phone: '+55 (85) 98421-1234', city: 'Fortaleza',
      lead: null,
      history: [
        { from: 'ai',   text: 'Olá! 👋 Como posso te ajudar hoje?', minutesAgo: 6 },
        { from: 'user', text: 'Oi! Quero uma solução para automatizar minhas vendas online', minutesAgo: 4 },
        { from: 'ai',   text: 'Perfeito! Qual produto ou serviço você tem interesse?', minutesAgo: 3 },
        { from: 'user', text: 'Ferramenta de automação de WhatsApp para vendas', minutesAgo: 2 },
        { from: 'ai',   text: 'Ótima escolha! 🚀 Qual a sua faixa de orçamento: Até R$1k, R$1k–5k, R$5k–20k, Acima de R$20k ou A definir?', minutesAgo: 1 },
      ],
    },
  ],
}

// ─── Estado reativo ───────────────────────────────────────────────────────────

function buildMessages(history: ContactDef['history']): Msg[] {
  const now = Date.now()
  return history.map((h, i) => ({
    id: `pre-${i}`,
    from: h.from,
    text: h.text,
    ts: new Date(now - h.minutesAgo * 60_000),
  }))
}

const convs      = reactive<Record<string, ConvState>>({})
const selectedId = ref('c1')
const messagesEl = ref<HTMLElement>()

function initContacts(contacts: ContactDef[]) {
  // Limpa convs anteriores
  Object.keys(convs).forEach(k => delete convs[k])
  contacts.forEach(c => {
    convs[c.id] = {
      messages:  buildMessages(c.history),
      isTyping:  false,
      isSending: false,
      lead:      c.lead,
    }
  })
  selectedId.value = contacts[0].id
  nextTick(scrollToBottom)
}

// Inicializa quando o vertical carrega
watch(() => ws.vertical?.slug, (slug) => {
  const contacts = CONTACTS_BY_VERTICAL[slug ?? 'education'] ?? CONTACTS_BY_VERTICAL.education
  initContacts(contacts)
}, { immediate: true })

const activeContacts = computed(() => {
  const slug = ws.vertical?.slug ?? 'education'
  return CONTACTS_BY_VERTICAL[slug] ?? CONTACTS_BY_VERTICAL.education
})

const current = computed(() => convs[selectedId.value])
const contact = computed(() => activeContacts.value.find(c => c.id === selectedId.value)!)

function select(id: string) {
  selectedId.value = id
  nextTick(scrollToBottom)
}

function scrollToBottom() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

// ─── Quick replies por conversa ────────────────────────────────────────────────

function getQuickReplies(contactId: string): string[] | null {
  const conv = convs[contactId]
  if (!conv || conv.lead || conv.isTyping || conv.isSending) return null

  const sortedFields = [...ws.fields].sort((a, b) => a.order - b.order)
  if (!sortedFields.length) return null

  const msgs = conv.messages
  if (!msgs.length) return null

  // Só mostra quando a última mensagem é da IA
  const lastMsg = msgs[msgs.length - 1]
  if (lastMsg.from !== 'ai') return null

  // Conta TODAS as mensagens da IA (inclusive pré-carregadas)
  // Primeira = saudação, demais = perguntas sobre campos
  const allAiMsgs = msgs.filter(m => m.from === 'ai')
  const fieldIdx  = allAiMsgs.length - 2 // -1 zero-index, -1 saudação

  if (fieldIdx < 0) return null

  const field = sortedFields[fieldIdx]
  return field?.type === 'select' && field.options?.length ? field.options : null
}

// ─── Envio de mensagem ─────────────────────────────────────────────────────────

const inputText = ref('')

async function send() {
  const text = inputText.value.trim()
  const conv = current.value
  if (!text || conv.isSending) return

  inputText.value = ''
  conv.isSending  = true

  const history = conv.messages.map(m => ({
    role:    m.from === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }))

  conv.messages.push({ id: crypto.randomUUID(), from: 'user', text, ts: new Date() })
  await nextTick(); scrollToBottom()
  await new Promise(r => setTimeout(r, 350))
  conv.isTyping = true
  await nextTick(); scrollToBottom()

  try {
    const res = await simulatorApi.sendMessage(text, history)
    conv.isTyping = false
    conv.messages.push({ id: crypto.randomUUID(), from: 'ai', text: res.reply, ts: new Date() })
    if (res.lead && !conv.lead) {
      conv.lead = { name: res.lead.name, data: res.lead.data, status: res.lead.status }
      if (!store.leads.find(l => l.id === res.lead!.id)) store.leads.unshift(res.lead)
    }
  } catch {
    conv.isTyping = false
    conv.messages.push({ id: crypto.randomUUID(), from: 'ai', text: '⚠ Erro de conexão. Tente novamente.', ts: new Date() })
  } finally {
    conv.isSending = false
    await nextTick(); scrollToBottom()
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtTimeAgo(d: Date) {
  const diff = Math.round((Date.now() - d.getTime()) / 60_000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `${diff}m`
  if (diff < 1440) return `${Math.round(diff / 60)}h`
  return `${Math.round(diff / 1440)}d`
}

function lastMsg(id: string) {
  const msgs = convs[id]?.messages
  return msgs?.[msgs.length - 1]
}

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo', CONTATO: 'Em Contato', ANALISE: 'Em Análise', INSCRITO: 'Inscrito',
  INTERESSE: 'Interesse', VISITA: 'Visita', PROPOSTA: 'Proposta', NEGOCIACAO: 'Negociação',
  AGENDADO: 'Agendado', CONFIRMADO: 'Confirmado', ATENDIDO: 'Atendido',
  MATRICULADO: 'Matriculado', CONTRATADO: 'Contratado', FECHADO: 'Fechado', PERDIDO: 'Perdido',
}

const STATUS_COLOR: Record<string, string> = {
  NOVO: '#2080f0', CONTATO: '#f0a020', ANALISE: '#5c6bc0', INSCRITO: '#8a2be2',
  INTERESSE: '#fb8c00', VISITA: '#ffa726', PROPOSTA: '#ab47bc', NEGOCIACAO: '#ff7043',
  AGENDADO: '#ad1457', CONFIRMADO: '#c2185b', ATENDIDO: '#18a058',
  MATRICULADO: '#18a058', CONTRATADO: '#18a058', FECHADO: '#18a058', PERDIDO: '#999',
}
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="wa-layout">
      <!-- Sidebar -->
      <aside class="wa-sidebar">
        <div class="wa-sidebar__header" :style="{ background: ws.brandColor }">
          <div class="wa-sidebar__title">
            <span class="wa-icon">W</span> WhatsApp
          </div>
          <span class="wa-sim-pill">simulado</span>
        </div>

        <div
          v-for="c in activeContacts"
          :key="c.id"
          class="wa-item"
          :class="{ 'wa-item--active': selectedId === c.id }"
          @click="select(c.id)"
        >
          <div class="wa-item__avatar" :style="{ background: ws.brandColor }">
            <span>{{ c.phone.slice(-4, -2) }}</span>
            <span v-if="convs[c.id]?.lead?.status === 'FECHADO' || convs[c.id]?.lead?.status === 'MATRICULADO' || convs[c.id]?.lead?.status === 'CONTRATADO' || convs[c.id]?.lead?.status === 'ATENDIDO'"
              class="wa-item__check">✓</span>
          </div>

          <div class="wa-item__body">
            <div class="wa-item__row">
              <span class="wa-item__name">{{ convs[c.id]?.lead?.name ?? c.phone }}</span>
              <span class="wa-item__time">{{ lastMsg(c.id) ? fmtTimeAgo(lastMsg(c.id)!.ts) : '' }}</span>
            </div>
            <div class="wa-item__sub">
              <span v-if="convs[c.id]?.lead" class="wa-item__pill"
                :style="{ background: STATUS_COLOR[convs[c.id]!.lead!.status] ?? '#999' }">
                {{ STATUS_LABEL[convs[c.id]!.lead!.status] ?? convs[c.id]!.lead!.status }}
              </span>
              <span v-else class="wa-item__preview">
                {{ lastMsg(c.id)?.text.slice(0, 36) }}…
              </span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Chat -->
      <section class="wa-chat">
        <div class="wa-chat__head" :style="{ background: ws.brandColor }">
          <div class="wa-chat__avatar">{{ contact?.phone.slice(-4, -2) }}</div>
          <div class="wa-chat__info">
            <div class="wa-chat__name">{{ current?.lead?.name ?? contact?.phone }}</div>
            <div class="wa-chat__meta">
              <template v-if="current?.lead">
                <span class="wa-chat__data">
                  {{ Object.values(current.lead.data).join(' · ') }}
                </span>
                <span class="wa-chat__status-pill"
                  :style="{ background: STATUS_COLOR[current.lead.status] ?? '#999' }">
                  {{ STATUS_LABEL[current.lead.status] ?? current.lead.status }}
                </span>
              </template>
              <span v-else class="wa-chat__city">{{ contact?.city }} · qualificando…</span>
            </div>
          </div>
          <span class="wa-badge-pill">via WhatsApp simulado</span>
        </div>

        <div ref="messagesEl" class="wa-msgs">
          <div class="wa-date-sep">Hoje</div>

          <div v-for="msg in current?.messages" :key="msg.id"
            class="msg-row" :class="{ 'msg-row--user': msg.from === 'user' }">
            <div class="bubble" :class="msg.from === 'user' ? 'bubble--user' : 'bubble--ai'">
              <span class="bubble__text">{{ msg.text }}</span>
              <span class="bubble__time">{{ fmtTime(msg.ts) }}</span>
            </div>
          </div>

          <div v-if="current?.isTyping" class="msg-row">
            <div class="bubble bubble--ai typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
        </div>

        <!-- Quick replies -->
        <QuickReplies
          v-if="selectedId && getQuickReplies(selectedId)"
          :options="getQuickReplies(selectedId)!"
          @select="inputText = $event; send()"
        />

        <!-- Lead banner -->
        <div v-if="current?.lead" class="lead-banner">
          <span>✅</span>
          <div>
            <strong>{{ current.lead.name }}</strong> qualificado
            <span class="lead-banner__tags">
              {{ Object.values(current.lead.data).join(' · ') }}
            </span>
          </div>
          <span class="lead-banner__status"
            :style="{ background: STATUS_COLOR[current.lead.status] ?? '#999' }">
            {{ STATUS_LABEL[current.lead.status] ?? current.lead.status }}
          </span>
        </div>

        <!-- Input -->
        <div class="wa-input">
          <input v-model="inputText" class="wa-input__field" placeholder="Mensagem…"
            :disabled="current?.isSending" @keydown="handleKey" />
          <button class="wa-input__send" :disabled="current?.isSending || !inputText.trim()"
            :style="{ background: ws.brandColor }" @click="send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </section>

      <!-- Painel do lead -->
      <aside v-if="current?.lead" class="lead-panel">
        <div class="lead-panel__title">Perfil do Lead</div>
        <div class="lead-panel__avatar" :style="{ background: ws.brandColor + '18', color: ws.brandColor }">
          {{ current.lead.name.charAt(0) }}
        </div>
        <div class="lead-panel__name">{{ current.lead.name }}</div>
        <div class="lead-panel__phone">{{ contact?.phone }}</div>
        <div class="lead-panel__divider"></div>
        <div v-for="[key, val] in Object.entries(current.lead.data)" :key="key" class="lead-panel__row">
          <span class="lead-panel__key">{{ ws.fieldLabel(key) }}</span>
          <span class="lead-panel__val">{{ val }}</span>
        </div>
        <div class="lead-panel__row">
          <span class="lead-panel__key">Status</span>
          <span class="lead-panel__badge"
            :style="{ background: STATUS_COLOR[current.lead.status] ?? '#999' }">
            {{ STATUS_LABEL[current.lead.status] ?? current.lead.status }}
          </span>
        </div>
        <div class="lead-panel__divider"></div>
        <p class="lead-panel__hint">Abra o Pipeline para avançar no funil.</p>
      </aside>

      <aside v-else class="lead-panel lead-panel--empty">
        <div class="lead-panel__empty-icon">🤖</div>
        <p class="lead-panel__empty-text">A IA está qualificando este contato.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.wa-layout { flex: 1; display: flex; overflow: hidden; }

/* Sidebar */
.wa-sidebar {
  width: 300px; flex-shrink: 0; background: #fff;
  border-right: 1px solid #e9edef; display: flex; flex-direction: column; overflow-y: auto;
}
.wa-sidebar__header {
  padding: 13px 16px; display: flex; align-items: center;
  justify-content: space-between; flex-shrink: 0;
}
.wa-sidebar__title {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: #fff;
}
.wa-icon {
  width: 26px; height: 26px; background: #25d366; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800; color: #fff;
}
.wa-sim-pill { font-size: 10px; background: rgba(255,255,255,0.2); color: #fff; padding: 2px 7px; border-radius: 10px; }

.wa-item {
  display: flex; gap: 10px; padding: 11px 14px;
  border-bottom: 1px solid #f5f5f5; cursor: pointer; transition: background 0.1s;
}
.wa-item:hover { background: #f9f9f9; }
.wa-item--active { background: #e8f5e9; }
.wa-item__avatar {
  width: 44px; height: 44px; border-radius: 50%; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; flex-shrink: 0; position: relative;
}
.wa-item__check {
  position: absolute; bottom: -2px; right: -2px;
  width: 16px; height: 16px; background: #18a058; border-radius: 50%;
  font-size: 9px; display: flex; align-items: center; justify-content: center;
  border: 2px solid #fff; color: #fff;
}
.wa-item__body { flex: 1; min-width: 0; }
.wa-item__row { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; }
.wa-item__name { font-size: 13px; font-weight: 600; color: #111b21; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-item__time { font-size: 11px; color: #aaa; flex-shrink: 0; }
.wa-item__sub { margin-top: 3px; display: flex; align-items: center; gap: 5px; }
.wa-item__pill { font-size: 10px; font-weight: 700; color: #fff; padding: 2px 7px; border-radius: 10px; }
.wa-item__preview { font-size: 12px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Chat */
.wa-chat { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #ece5dd; }
.wa-chat__head {
  padding: 10px 18px; display: flex; align-items: center;
  gap: 12px; flex-shrink: 0;
}
.wa-chat__avatar {
  width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2);
  color: #fff; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.wa-chat__info { flex: 1; min-width: 0; }
.wa-chat__name { font-size: 14px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-chat__meta { display: flex; align-items: center; gap: 7px; margin-top: 2px; }
.wa-chat__data { font-size: 11px; color: rgba(255,255,255,0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.wa-chat__status-pill { font-size: 10px; font-weight: 700; color: #fff; padding: 1px 7px; border-radius: 10px; flex-shrink: 0; }
.wa-chat__city { font-size: 12px; color: rgba(255,255,255,0.65); }
.wa-badge-pill { font-size: 10px; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 10px; white-space: nowrap; flex-shrink: 0; }

/* Messages */
.wa-msgs { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 3px; }
.wa-date-sep { text-align: center; font-size: 11px; color: #666; background: rgba(255,255,255,0.6); border-radius: 8px; padding: 3px 10px; align-self: center; margin-bottom: 4px; }
.msg-row { display: flex; justify-content: flex-start; padding: 1px 0; }
.msg-row--user { justify-content: flex-end; }
.bubble { max-width: 68%; padding: 7px 11px 4px; border-radius: 16px; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.bubble--ai  { background: #fff; color: #111b21; border-radius: 16px 16px 16px 4px; }
.bubble--user{ background: #dcf8c6; color: #111b21; border-radius: 16px 16px 4px 16px; }
.bubble__text { display: block; font-size: 13.5px; line-height: 1.5; }
.bubble__time { display: block; font-size: 10px; margin-top: 2px; text-align: right; opacity: 0.5; }
.typing { padding: 10px 14px; display: flex; gap: 4px; align-items: center; }
.dot { width: 7px; height: 7px; background: #aaa; border-radius: 50%; animation: bounce 1.2s infinite ease-in-out; }
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }

/* Lead banner */
.lead-banner {
  background: #e8f8f0; border-top: 1px solid #b2dfdb;
  padding: 9px 18px; display: flex; align-items: center; gap: 10px;
  flex-shrink: 0; font-size: 13px; color: #1e8449;
}
.lead-banner__tags { display: block; font-size: 11px; color: #555; font-weight: normal; }
.lead-banner__status { margin-left: auto; font-size: 11px; font-weight: 700; color: #fff; padding: 2px 9px; border-radius: 10px; flex-shrink: 0; }

/* Input */
.wa-input { background: #f0f2f5; border-top: 1px solid #e9edef; padding: 10px 14px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.wa-input__field { flex: 1; border: none; background: #fff; border-radius: 24px; padding: 9px 16px; font-size: 14px; outline: none; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
.wa-input__field::placeholder { color: #bbb; }
.wa-input__send { width: 42px; height: 42px; border-radius: 50%; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s; }
.wa-input__send:hover:not(:disabled) { opacity: 0.85; }
.wa-input__send:disabled { opacity: 0.4; cursor: not-allowed; }

/* Lead panel */
.lead-panel {
  width: 240px; flex-shrink: 0; background: #fff; border-left: 1px solid #e9edef;
  padding: 20px 16px; display: flex; flex-direction: column; align-items: center;
  gap: 8px; overflow-y: auto;
}
.lead-panel--empty { justify-content: center; text-align: center; }
.lead-panel__title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #aaa; align-self: flex-start; margin-bottom: 8px; }
.lead-panel__avatar { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; }
.lead-panel__name { font-size: 15px; font-weight: 700; color: #111b21; text-align: center; }
.lead-panel__phone { font-size: 12px; color: #aaa; }
.lead-panel__divider { width: 100%; height: 1px; background: #f0f0f0; margin: 4px 0; }
.lead-panel__row { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.lead-panel__key { font-size: 11px; color: #888; }
.lead-panel__val { font-size: 11px; font-weight: 600; color: #333; text-align: right; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lead-panel__badge { font-size: 11px; font-weight: 700; color: #fff; padding: 2px 9px; border-radius: 10px; }
.lead-panel__hint { font-size: 11px; color: #aaa; text-align: center; margin: 4px 0 0; line-height: 1.5; }
.lead-panel__empty-icon { font-size: 40px; opacity: 0.3; }
.lead-panel__empty-text { font-size: 12px; color: #aaa; text-align: center; line-height: 1.6; margin: 0; }
</style>
