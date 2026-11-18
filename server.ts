/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

function parseRequestBody(req: express.Request): any {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

// Desativa cache HTTP nas rotas da API para garantir dados sempre em tempo real
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Diretório de dados do portal e arquivo mestre único blindado
const DATA_DIR = path.resolve(process.cwd(), 'data');
const MASTER_DB_FILE = path.join(DATA_DIR, 'gimi_master_db.json');
const MASTER_DB_TMP_FILE = path.join(DATA_DIR, 'gimi_master_db.json.tmp');
const MASTER_DB_BAK_FILE = path.join(DATA_DIR, 'gimi_master_db.json.bak');

// Arquivos legados (usados exclusivamente para migração na primeira inicialização limpa)
const LEGACY_DB_FILE = path.join(DATA_DIR, 'portal-db.json');
const PESOS_DIR = path.join(DATA_DIR, 'pesos');
const LEGACY_PESOS_DB_FILE = path.join(PESOS_DIR, 'pesos-db.json');
const ELETRICA_DIR = path.join(DATA_DIR, 'eletrica');
const LEGACY_CAPACITORES_DB_FILE = path.join(ELETRICA_DIR, 'capacitores.json');
const LEGACY_CASCATEAMENTO_DB_FILE = path.join(ELETRICA_DIR, 'cascateamento.json');
const R026_DIR = path.join(DATA_DIR, 'r026');
const LEGACY_R026_EMAILS_FILE = path.join(R026_DIR, 'emails_config.json');
const LEGACY_R026_HISTORICO_FILE = path.join(DATA_DIR, 'historico_r026.json');
const LEGACY_R026_LEGACY_HISTORICO_FILE = path.join(R026_DIR, 'historico.json');
const LEGACY_CONEXOES_DB_FILE = path.join(DATA_DIR, 'conexoes_barramentos.json');
const LEGACY_ARMARIO_CONFIG_FILE = path.join(DATA_DIR, 'armario_config.json');
const TOOLS_DIR = path.join(__dirname, 'tools');

// Garante que os diretórios data, data/pesos, data/eletrica, data/r026 e tools existem
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PESOS_DIR)) {
  fs.mkdirSync(PESOS_DIR, { recursive: true });
}
if (!fs.existsSync(ELETRICA_DIR)) {
  fs.mkdirSync(ELETRICA_DIR, { recursive: true });
}
if (!fs.existsSync(R026_DIR)) {
  fs.mkdirSync(R026_DIR, { recursive: true });
}
if (!fs.existsSync(TOOLS_DIR)) {
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
}

// Lista padrão das 27 ferramentas da engenharia GIMI
const DEFAULT_TOOLS = [
  {
    id: 'zwcad-app',
    titulo: 'Aplicação 4',
    categoria: 'zwcad',
    badge: 'Em Desenvolvimento',
    url: '#',
    descricao: 'Futura ferramenta integrada para otimização de blocos dinâmicos, despoluição de pranchas (Purge/Audit) e plotagem no ZWcad. Ferramenta em progresso de desenvolvimento.',
    fala: '<b>Aplicação 4 (ZWcad).</b> Módulo sob desenvolvimento para gerenciar pranchas, limpezas e plotagem eletrônica automática.',
    bloqueado: true,
    actionText: 'Bloqueado 🔒'
  },
  {
    id: 'projetos-historico',
    titulo: 'Biblioteca Histórica',
    categoria: 'projetos',
    badge: 'Em Desenvolvimento',
    url: '#',
    descricao: 'Arquivo de consulta para revisar designs antigos de painéis GIMI, esquemas unifilares legados e revisões faturadas. Ferramenta em progresso de desenvolvimento.',
    fala: '<b>Biblioteca Histórica.</b> Módulo sob planejamento ativo para integração ao nosso acervo de desenhos históricos.',
    bloqueado: true,
    orbitRing: 3,
    orbitLabel: '📚 BIBLIOTECA HISTÓRICA',
    actionText: 'Bloqueado 🔒'
  },
  {
    id: 'projetos-ativos',
    titulo: 'Projetos Ativos 2026',
    categoria: 'projetos',
    badge: 'Em Desenvolvimento',
    url: '#',
    descricao: 'Diretório de rede contendo todos os desenhos, diagramas, listas de fiação e pranchas de projeto desenvolvidos em 2026. Ferramenta em progresso de desenvolvimento.',
    fala: '<b>Projetos Ativos (2026).</b> Módulo sob planejamento ativo para integração ao nosso servidor de rede.',
    bloqueado: true,
    orbitRing: 3,
    orbitLabel: '📁 PROJETOS 2026',
    actionText: 'Bloqueado 🔒'
  },
  {
    id: 'cipo',
    titulo: 'C.I.P.O',
    categoria: 'ferramentas',
    badge: 'Ativo',
    url: 'https://docs.google.com/document/d/1TAXBicKtmhvMcbQKqXsQZFnaVfH9IFGmiQ4pz-0AojY/edit?tab=t.0#heading=h.vyqb0thxfdho',
    descricao: 'Central de Informações e Processos da Obra. Repositório para registrar detalhes e dados técnicos da obra que não se enquadram ou não cabem nos esquemas em PDF ou no controle R024.',
    fala: '<b>C.I.P.O.</b> Central de Informações e Processos da Obra. Detalhes técnicos que não cabem no PDF ou no R024!',
    orbitRing: 2,
    orbitLabel: '📋 C.I.P.O',
    actionText: 'Abrir Documento ↗'
  },
  {
    id: 'chaparia-com-chapa',
    titulo: 'Suíte Mecânica',
    categoria: 'ferramentas',
    badge: 'SUÍTE INTEGRADA • ATIVO',
    url: '/ferramentas/chaparia-com-chapa/',
    descricao: 'Ambiente unificado de engenharia mecânica: parametrização e busca reversa de chaparia, cálculo de peso acumulado de quadros/barramentos e gestão de estruturas. Módulo expansível: novas ferramentas e cubículos serão integrados em breve.',
    fala: '<b>Suíte Mecânica!</b> Ambiente unificado de engenharia mecânica com Configurador de Chaparia, Calculadora de Pesos e Banco Permanente sincronizado em rede!',
    orbitRing: 2,
    orbitLabel: '🔧⚖️ SUÍTE MECÂNICA',
    actionText: 'ABRIR SUÍTE ↗'
  },
  {
    id: 'eplan-molduras',
    titulo: 'Capas, Molduras e Formulários',
    categoria: 'eplan',
    badge: 'Documento',
    url: 'https://docs.google.com/document/d/1iZ1-x9e083yO78h4c3M_E6p-H15kM49520Yv18L1wD8/edit?tab=t.0#heading=h.35nkun2',
    descricao: 'Normas visuais, padrões de capa, carimbos homologados e formulários oficiais para projetos elétricos no EPLAN.',
    fala: '<b>Molduras e Formulários Eplan.</b> O guia definitivo de padronização estética dos nossos esquemas elétricos.',
    actionText: 'Abrir Documento ↗'
  },
  {
    id: 'eplan-conexoes',
    titulo: 'Conexões no EPLAN',
    categoria: 'eplan',
    badge: 'Documento',
    url: 'https://docs.google.com/document/d/1yK9B9kF2M1kL0pQ8R6sT4uV3wX2yZ1aB/edit?usp=sharing',
    descricao: 'Guia de boas práticas para conexões, roteamento lógico de condutores, numeração de bornes e pontos de potencial elétrico.',
    fala: '<b>Conexões no Eplan.</b> Roteamento de fios e cabos sem nós e sem erro no relatório de fiação!',
    actionText: 'Abrir Documento ↗'
  },
  {
    id: 'eletrica-protecao',
    titulo: 'Suíte Elétrica',
    categoria: 'ferramentas',
    badge: 'SUÍTE INTEGRADA • ATIVO',
    url: '/ferramentas/eletrica-protecao/',
    descricao: 'Ambiente unificado de engenharia elétrica: cálculo de coordenação e seletividade técnica (cascateamento WEG/ABB) e dimensionamento analítico de bancos de capacitores. Módulo expansível: novas rotinas e dimensionamentos em desenvolvimento para adição contínua.',
    fala: '<b>Suíte Elétrica!</b> Coordenação de cascateamento WEG/ABB e dimensionamento analítico de bancos de capacitores sincronizados no servidor com o Promete!',
    orbitRing: 2,
    orbitLabel: '⚡🛡️ SUÍTE ELÉTRICA',
    actionText: 'ABRIR SUÍTE ↗'
  },
  {
    id: 'central-r026',
    titulo: 'Central R026 - Liberação de Projetos',
    categoria: 'ferramentas',
    badge: 'OFICIAL • ATIVO',
    url: '/ferramentas/central-r026',
    descricao: 'Controle oficial de liberações R026 (Mecânico, Fábrica, Substituição e Paralisação) com disparo automatizado de e-mails via Node.js e sincronização global em rede.',
    fala: '<b>Central R026 - Liberação de Projetos!</b> Disparo automatizado de e-mails via Node.js com o Técnico Especialista Minduim e histórico global em rede!',
    orbitRing: 2,
    orbitLabel: '📧 CENTRAL R026',
    actionText: 'ABRIR CENTRAL R026 ↗'
  },
  {
    id: 'conexoes-barramentos',
    titulo: 'Suíte de Conexões & Barramentos',
    categoria: 'ferramentas',
    badge: 'SUÍTE INTEGRADA • ATIVO',
    url: '/ferramentas/conexoes-barramentos/',
    descricao: 'Dimensionamento de conexões e furações, terminais de potência (cobre vs bimetálico), dimensionador analítico de barramentos (BCO/BG/BN) e lista de materiais (BOM da Plan4).',
    fala: '<b>Suíte de Conexões & Barramentos!</b> Dimensionamento analítico de terminais, barramentos de potência e lista de materiais (BOM) da Plan4 integrados ao backend!',
    orbitRing: 2,
    orbitLabel: '🔌⚡ CONEXÕES & BARRAMENTOS',
    actionText: 'ABRIR SUÍTE ↗'
  },
  {
    id: 'pfannenberg-pss',
    titulo: 'Pfannenberg Sizing Software (PSS)',
    subtitulo: 'Parceiro Oficial · Climatização & Gestão Térmica',
    categoria: 'ferramentas',
    badge: 'Parceiro Oficial',
    url: 'http://www.pss-pfannenberg.de/?__hstc=241424157.fe6a78d5be819d9562dba99bac2953af.1769083015821.1769083015821.1769083015821.1&__hssc=241424157.2.1769083015821&__hsfp=aae94ee846c4873027431098e970d933&submissionGuid=7fed248b-0831-4bfe-a330-5265a22070f5',
    descricao: 'Sistema oficial de cálculo de dissipação térmica, trocadores de calor, exaustores com filtro e condicionadores de ar para painéis elétricos.',
    fala: '<b>Pfannenberg Sizing Software (PSS)!</b> Parceiro oficial para cálculo térmico, trocadores de calor, exaustores e condicionadores de ar.',
    orbitRing: 2,
    orbitLabel: '🌡️ PFANNENBERG PSS',
    actionText: 'ACESSAR PSS ↗',
    isPartner: true,
    iconType: 'thermal'
  },
  {
    id: 'eplan-macros',
    titulo: 'Criação de Macros',
    categoria: 'eplan',
    badge: 'Documento',
    url: 'https://docs.google.com/document/d/1wX8Z7aB5c9e1f2g3h4i5j6k7l8m9n0o/edit?usp=sharing',
    descricao: 'Metodologia padrão para criação, agrupamento e manutenção de macros de circuito no EPLAN Electric P8.',
    fala: '<b>Criação de Macros Eplan.</b> Poupe tempo repetindo blocos prontos de partida e controle!',
    actionText: 'Abrir Documento ↗'
  },
  {
    id: 'eplan-tabela',
    titulo: 'Edição em Tabela',
    categoria: 'eplan',
    badge: 'Documento',
    url: 'https://docs.google.com/document/d/1pQ9R8sT7uV6wX5yZ4aB3c2d1e0f9g8h/edit?usp=sharing',
    descricao: 'Dicas para edição em massa de dispositivos, tags (DTs) e textos de função utilizando a interface de tabela do EPLAN.',
    fala: '<b>Edição em Tabela.</b> Renomeie dezenas de disjuntores em segundos sem abrir propriedade por propriedade.',
    actionText: 'Abrir Documento ↗'
  },
  {
    id: 'app-gemini',
    titulo: 'Gemini',
    categoria: 'aplicativos',
    badge: 'IA',
    url: 'https://gemini.google.com/app?hl=pt-BR',
    descricao: 'Inteligência Artificial do Google para auxiliar na redação de relatórios técnicos, scripts de automação e consultas técnicas.',
    fala: '<b>Gemini IA.</b> A inteligência artificial pronta para auxiliar nos cálculos, fórmulas e redação de memoriais descritivos.',
    orbitRing: 1,
    orbitLabel: '🤖 GEMINI',
    actionText: 'Iniciar Conversa ↗'
  },
  {
    id: 'app-gimix',
    titulo: 'GIMIX',
    categoria: 'aplicativos',
    badge: 'Ativo',
    url: 'https://gimix.vercel.app/dashboard/',
    descricao: 'Dashboard corporativo integrado para visualização de indicadores de projeto, ordens de serviço e cronogramas de engenharia.',
    fala: '<b>GIMIX Dashboard.</b> O coração operacional do nosso departamento de engenharia em tempo real.',
    orbitRing: 1,
    orbitLabel: '⚡ GIMIX',
    actionText: 'Acessar Painel ↗'
  },
  {
    id: 'app-iapp',
    titulo: 'IAPP',
    categoria: 'aplicativos',
    badge: 'Ativo',
    url: 'https://iapp.iniciativaaplicativos.com.br/login',
    descricao: 'Plataforma oficial da iniciativa de aplicativos para gestão e sincronização de dados internos da fábrica.',
    fala: '<b>IAPP.</b> Plataforma de gerenciamento e acesso aos aplicativos operacionais integrados.',
    orbitRing: 1,
    orbitLabel: '📦 IAPP',
    actionText: 'Acessar Sistema ↗'
  },
  {
    id: 'manuais-produtos',
    titulo: 'Manuais de Produtos GIMI',
    categoria: 'manuais',
    badge: 'Pasta Drive',
    url: 'https://drive.google.com/drive/folders/17X53dbkA5kraLp3K25Xo9fBdQ6wedBJ0',
    descricao: 'Acervo completo com catálogos, fichas técnicas e manuais de instalação de toda a linha de barramentos e painéis GIMI.',
    fala: '<b>Manuais de Produtos GIMI.</b> Catálogos técnicos, características de barramentos e capacidades de corrente nominais.',
    orbitRing: 4,
    orbitLabel: '📘 MANUAIS DE PRODUTOS',
    actionText: 'Acessar Pasta ↗'
  },
  {
    id: 'manuais-obra',
    titulo: 'Padrões de Obra',
    categoria: 'manuais',
    badge: 'Pasta Drive',
    url: 'https://drive.google.com/drive/folders/1DHuZLpwdsnNGz33cbjjHK2balTL3hbAP',
    descricao: 'Especificações técnicas de montagem, requisitos civis de subestações e orientações de segurança em canteiros de obra.',
    fala: '<b>Padrões de Obra.</b> Especificações civis, bases de alvenaria e diretrizes de montagem em campo.',
    orbitRing: 4,
    orbitLabel: '🏢 PADRÕES DE OBRA',
    actionText: 'Acessar Pasta ↗'
  },
  {
    id: 'eplan-faturamento',
    titulo: 'Procedimento para Faturamento EPLAN',
    categoria: 'eplan',
    badge: 'Documento',
    url: 'https://docs.google.com/document/d/1kL8M7nO6pQ5rS4tU3vW2xY1zA0bC9dE/edit?usp=sharing',
    descricao: 'Passo a passo com os critérios indispensáveis para liberação do projeto executivo para faturamento comercial.',
    fala: '<b>Faturamento no Eplan.</b> Não libere projeto sem checar essa lista de conferência prévia!',
    actionText: 'Abrir Documento ↗'
  },
  {
    id: 'manuais-processos',
    titulo: 'Processos de Engenharia Elétrica (ISO)',
    categoria: 'manuais',
    badge: 'Instrução',
    url: 'https://portal-iso.vercel.app/instructions/816dba2d-ac11-49b0-b19e-14234a65551a',
    descricao: 'Mapeamento oficial dos processos internos de desenho, cálculo e validação técnica do setor elétrico segundo a ISO 9001.',
    fala: '<b>Processos da Elétrica (ISO).</b> O fluxo operacional padronizado e auditado para a excelência dos projetos.',
    orbitRing: 4,
    orbitLabel: '📄 PROCESSOS ISO',
    actionText: 'Abrir Instrução ↗'
  },
  {
    id: 'iso-r024',
    titulo: 'R024 Controle de Projetos',
    categoria: 'ferramentas-iso',
    badge: 'Planilha',
    url: 'https://docs.google.com/spreadsheets/d/1fsnqS4QMF-Z47okJiJCdIHFpIYyWS09nq59fereHZGE/edit?gid=848993365#gid=848993365',
    descricao: 'Planilha mestre de acompanhamento de status, revisões, emissão de desenhos e cronograma de entrega da engenharia.',
    fala: '<b>R024 Controle de Projetos.</b> A planilha oficial de acompanhamento de prazos e revisões ativas.',
    orbitRing: 3,
    orbitLabel: '📊 R024 PROJETOS',
    actionText: 'Abrir Planilha ↗'
  },
  {
    id: 'iso-r026',
    titulo: 'R026 Lista de Liberações',
    categoria: 'ferramentas-iso',
    badge: 'Planilha',
    url: 'https://docs.google.com/spreadsheets/d/1NhNAuzIj8jKaUaxAXEIcsrtmmWQcZbQYLYZpfOW0sqs/edit?gid=1124704621#gid=1124704621',
    descricao: 'Registro formal de liberação de desenhos para fábrica, cortes a laser, montagem e inspeção da qualidade.',
    fala: '<b>R026 Lista de Liberações.</b> Histórico de aprovações formais de projetos prontos para montagem na fábrica.',
    orbitRing: 3,
    orbitLabel: '📊 R026 LIBERAÇÕES',
    actionText: 'Abrir Planilha ↗'
  },
  {
    id: 'iso-r217',
    titulo: 'R217 Cadastro de Documentos da Engenharia',
    categoria: 'ferramentas-iso',
    badge: 'Planilha',
    url: 'https://docs.google.com/spreadsheets/d/1WEU3FpJW2RAzWp81vI_OEWQIjjd4WdD4DE8WWFEAKxY/edit?gid=995313755#gid=995313755',
    descricao: 'Índice de codificação, controle de revisões vigentes e arquivos mestres emitidos pelo departamento de engenharia.',
    fala: '<b>R217 Cadastro de Documentos.</b> Central de numeração e controle documental dos projetos elétricos da GIMI.',
    orbitRing: 3,
    orbitLabel: '📝 R217 CADASTRO',
    actionText: 'Abrir Planilha ↗'
  },
  {
    id: 'app-secullum',
    titulo: 'Secullum Ponto Web',
    categoria: 'aplicativos',
    badge: 'Ativo',
    url: 'https://centraldofuncionario.com.br/55657/cartao-ponto',
    descricao: 'Acesso rápido para conferência e registro do cartão de ponto eletrônico individual dos colaboradores.',
    fala: '<b>Secullum Ponto.</b> Horário de entrada, almoço e saída sem esquecer de bater o ponto!',
    orbitRing: 1,
    orbitLabel: '⏱️ SECULLUM',
    actionText: 'Acessar Cartão ↗'
  },
  {
    id: 'manuais-treinamento',
    titulo: 'Treinamentos de Integração',
    categoria: 'manuais',
    badge: 'Vídeos',
    url: 'https://drive.google.com/drive/folders/11lMGqEiAvDHrDq-S_yDrVA35N1Jxe1tw',
    descricao: 'Vídeos tutoriais, aulas de capacitação interna e guias rápidos para novos projetistas e estagiários.',
    fala: '<b>Treinamentos da Engenharia.</b> Módulos de vídeo e aulas práticas gravadas pela nossa equipe.',
    orbitRing: 4,
    orbitLabel: '🎥 TREINAMENTOS',
    actionText: 'Acessar Pasta ↗'
  },
  {
    id: 'eplan-treinamento-vid',
    titulo: 'Treinamentos Eplan (Vídeo)',
    categoria: 'eplan',
    badge: 'Vídeos',
    url: 'https://drive.google.com/drive/folders/12mN_oPqRsTuVwXyZ0aBcDeFgHiJkLmNo',
    descricao: 'Aulas em vídeo demonstrando comandos avançados, atalhos de produtividade e relatórios automáticos no EPLAN.',
    fala: '<b>Treinamentos Eplan em Vídeo.</b> Aulas práticas para dominar a ferramenta e produzir esquemas mais rápidos.',
    actionText: 'Assistir Aulas ↗'
  },
  {
    id: 'eplan-atualizacao-bd',
    titulo: 'Vídeo Atualização BD Eplan',
    categoria: 'eplan',
    badge: 'Vídeos',
    url: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/view?usp=sharing',
    descricao: 'Instruções para sincronizar a base local de peças, blocos 3D e fabricantes com o servidor da rede.',
    fala: '<b>Atualização do BD Eplan.</b> Mantenha sua biblioteca de peças de disjuntores e contatores sempre em dia!',
    actionText: 'Assistir Vídeo ↗'
  },
  {
    id: 'eplan-faturamento-vid',
    titulo: 'Vídeo Procedimento de Faturamento EPLAN',
    categoria: 'eplan',
    badge: 'Vídeos',
    url: 'https://drive.google.com/file/d/1bCdEfGhIjKlMnOpQrStUvWxYz0123456/view?usp=sharing',
    descricao: 'Tutorial passo a passo em vídeo cobrindo todas as etapas de checklist para faturamento sem pendências.',
    fala: '<b>Vídeo de Faturamento.</b> Veja na tela o procedimento exato para validar os dados do painel.',
    actionText: 'Assistir Vídeo ↗'
  }
];

function normalizeUserKey(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\.+$/g, '')
    .replace(/[.\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LEGACY_REMOVED_USER_KEYS = new Set([
  'felipe-r',
  'lucas-silva',
  'renato-souza',
  'mariana-costa',
  'carlos-eduardo',
  'diego-almeida'
]);

// Usuários pré-cadastrados com papéis de acesso (RBAC), cargos e senhas
// Apenas Patrick Monteiro, Felipe Ramos e William Pessoa são administradores com senha.
// Todos os 14 projetistas elétricos abaixo acessam com 1 clique sem senha.
const DEFAULT_USERS: Record<string, {
  nome: string;
  cargo: string;
  role: 'admin' | 'user';
  senha?: string;
  favoritos: string[];
}> = {
  'patrick-monteiro': {
    nome: 'Patrick Monteiro',
    cargo: 'Projetista Elétrico',
    role: 'admin',
    senha: 'PE14@GSQA',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'iso-r024', 'cipo']
  },
  'felipe-ramos': {
    nome: 'Felipe Ramos',
    cargo: 'Líder',
    role: 'admin',
    senha: 'PE07@GSQA',
    favoritos: ['app-gimix', 'central-r026', 'eplan-molduras', 'chaparia-com-chapa', 'cipo']
  },
  'william-pessoa': {
    nome: 'William Pessoa',
    cargo: 'Gestor',
    role: 'admin',
    senha: 'PE01@GSQA',
    favoritos: ['app-gimix', 'central-r026', 'iso-r024', 'cipo']
  },
  'bruno-l': {
    nome: 'BRUNO L.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'bruno-s': {
    nome: 'BRUNO S.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'claudio-b': {
    nome: 'CLAUDIO B.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'geraldo-s': {
    nome: 'GERALDO S.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'gustavo-a': {
    nome: 'GUSTAVO A.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'lucas-l': {
    nome: 'LUCAS L.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'mailson-g': {
    nome: 'MAILSON G.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'mateus-r': {
    nome: 'MATEUS R.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'patrick-s': {
    nome: 'PATRICK S.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'rodrigo-r': {
    nome: 'RODRIGO R.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'sebastiao-x': {
    nome: 'SEBASTIÃO X.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'thayla-n': {
    nome: 'THAYLA N.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'walther-m': {
    nome: 'WALTHER M.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  },
  'weber-f': {
    nome: 'WEBER F.',
    cargo: 'Projetista Elétrico',
    role: 'user',
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  }
};

const VALID_ACCESS_PROFILES = ['engenharia', 'orcamentos', 'fabrica', 'visitante'] as const;
type ServerAccessProfile = (typeof VALID_ACCESS_PROFILES)[number];

interface ServerToolPermission {
  hiddenGlobally: boolean;
  allowedProfiles: ServerAccessProfile[];
}

function normalizeServerAccessProfile(raw?: unknown): ServerAccessProfile | undefined {
  const clean = String(raw || '').trim().toLowerCase() as ServerAccessProfile;
  return (VALID_ACCESS_PROFILES as readonly string[]).includes(clean) ? clean : undefined;
}

function normalizePermissionsMapServer(raw: unknown): Record<string, ServerToolPermission> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const validSet = new Set<string>(VALID_ACCESS_PROFILES);
  const normalized: Record<string, ServerToolPermission> = {};
  for (const [toolId, cfg] of Object.entries(raw as Record<string, any>)) {
    if (!toolId || !cfg || typeof cfg !== 'object') continue;
    const allowed = Array.isArray(cfg.allowedProfiles)
      ? Array.from(
          new Set(
            cfg.allowedProfiles
              .map((p: unknown) => String(p || '').trim().toLowerCase())
              .filter((p: string): p is ServerAccessProfile => validSet.has(p))
          )
        )
      : [...VALID_ACCESS_PROFILES];
    normalized[toolId] = {
      hiddenGlobally: Boolean(cfg.hiddenGlobally),
      allowedProfiles: allowed
    };
  }
  return normalized;
}

// ==========================================
// ARQUITETURA CENTRALIZADA DE PERSISTÊNCIA: gimi_master_db.json
// ==========================================

interface HubUserRecord {
  key: string;
  nome: string;
  cargo: string;
  perfilAcesso?: ServerAccessProfile;
  role: 'admin' | 'user';
  senha?: string;
  favoritos: string[];
}

interface ProjetosStore {
  activeDraft: any | null;
  projetos: Record<string, { id: string; nome: string; updatedAt: string; data: any }>;
}

interface MasterDatabase {
  meta: { version: string; updatedAt: string };
  hub_permissions: Record<string, ServerToolPermission>;
  hub_users: HubUserRecord[];
  banco_componentes: any[];
  banco_quadros_custom: any[];
  banco_armarios_custom: any[];
  banco_almofadas_custom: any[];
  deleted_ids: string[];
  projetos_conexoes: ProjetosStore;
  projetos_mecanica: ProjetosStore;
  hub_tools: any[];
  migrations: Record<string, boolean>;
  pesos_outros: {
    cubiculotraf: any[];
    cabinebarramento: any[];
    simplificada: any[];
    chapas: any[];
  };
  eletrica: {
    capacitores: any[];
    dimensionamentos: any[];
    cascateamento: any[];
  };
  r026: {
    emails: Record<string, { destinatarios: string[]; interessados: string[] }>;
    projetistas: any[];
    historico: any[];
  };
  conexoes_base: {
    terminais: any[];
    barramentos_nominais: any[];
    tubos_termocontrateis_tabela: any[];
  };
}

const DEFAULT_PESOS_SEED = {
  componentes: [
    { id: 'cp_miscelania', nome: 'MISCELÂNIA', peso: 0.5, perdaW: 2.0 },
    { id: 'cp_conjunto_dps', nome: 'CONJUNTO DPS SURTO', peso: 0.62, perdaW: 2.0 },
    { id: 'cp_mini_disjuntor_mono', nome: 'MINI DISJUNTOR DIN 1P', peso: 0.12, perdaW: 2.5 },
    { id: 'cp_mini_disjuntor_bi', nome: 'MINI DISJUNTOR DIN 2P', peso: 0.22, perdaW: 4.5 },
    { id: 'cp_mini_disjuntor_tri', nome: 'MINI DISJUNTOR DIN 3P', peso: 0.33, perdaW: 7.5 },
    { id: 'cp_mccb_160a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 160A', peso: 1.1, perdaW: 25.0 },
    { id: 'cp_mccb_250a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 250A', peso: 2.1, perdaW: 38.0 },
    { id: 'cp_mccb_400a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 400A', peso: 4.0, perdaW: 65.0 },
    { id: 'cp_mccb_630a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 630A', peso: 7.5, perdaW: 95.0 },
    { id: 'cp_mccb_800a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 800A', peso: 7.5, perdaW: 120.0 },
    { id: 'cp_mccb_1250a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 1250A', peso: 8.0, perdaW: 160.0 },
    { id: 'cp_mccb_1600a', nome: 'DISJUNTOR CAIXA MOLDADA (MCCB) 1600A', peso: 12.0, perdaW: 210.0 },
    { id: 'cp_acb_1600a', nome: 'DISJUNTOR ABERTO (ACB) 1600A', peso: 42.0, perdaW: 250.0 },
    { id: 'cp_acb_2000a', nome: 'DISJUNTOR ABERTO (ACB) 2000A', peso: 50.0, perdaW: 320.0 },
    { id: 'cp_acb_2500a', nome: 'DISJUNTOR ABERTO (ACB) 2500A', peso: 52.0, perdaW: 390.0 },
    { id: 'cp_acb_3200a', nome: 'DISJUNTOR ABERTO (ACB) 3200A', peso: 61.0, perdaW: 520.0 },
    { id: 'cp_contator_aux', nome: 'CONTATOR COMANDO / AUXILIAR CWCA0/CAD', peso: 0.20, perdaW: 4.5 },
    { id: 'cp_contator_25a', nome: 'CONTATOR DE POTÊNCIA 9A A 25A', peso: 0.40, perdaW: 6.0 },
    { id: 'cp_contator_50a', nome: 'CONTATOR DE POTÊNCIA 32A A 50A', peso: 0.91, perdaW: 14.0 },
    { id: 'cp_contator_95a', nome: 'CONTATOR DE POTÊNCIA 65A A 105A', peso: 1.46, perdaW: 28.0 },
    { id: 'cp_contator_225a', nome: 'CONTATOR DE POTÊNCIA 140A A 225A', peso: 3.20, perdaW: 48.0 },
    { id: 'cp_contator_600a', nome: 'CONTATOR DE POTÊNCIA 300A A 600A', peso: 6.50, perdaW: 95.0 },
    { id: 'cp_rele_sobrecarga', nome: 'RELÉ DE SOBRECARGA TÉRMICO ATÉ 100A', peso: 0.35, perdaW: 5.0 },
    { id: 'cp_tc_630a', nome: 'TC BAIXA TENSÃO 50/5A A 630/5A', peso: 0.30, perdaW: 3.0 },
    { id: 'cp_tc_2000a', nome: 'TC BAIXA TENSÃO 800/5A A 2000/5A', peso: 1.50, perdaW: 6.0 },
    { id: 'cp_tc_4000a', nome: 'TC BAIXA TENSÃO 2500/5A A 4000/5A', peso: 2.80, perdaW: 10.0 },
    { id: 'cp_tp_50va', nome: 'TP BAIXA TENSÃO 15VA A 50VA', peso: 0.50, perdaW: 4.0 },
    { id: 'cp_tp_100va', nome: 'TP BAIXA TENSÃO 100VA', peso: 1.20, perdaW: 8.0 },
    { id: 'cp_vfd_5cv', nome: 'INVERSOR DE FREQUÊNCIA (VFD) 1CV A 5CV', peso: 1.50, perdaW: 45.0 },
    { id: 'cp_vfd_15cv', nome: 'INVERSOR DE FREQUÊNCIA (VFD) 7.5CV A 15CV', peso: 3.50, perdaW: 110.0 },
    { id: 'cp_vfd_50cv', nome: 'INVERSOR DE FREQUÊNCIA (VFD) 20CV A 50CV', peso: 12.00, perdaW: 320.0 },
    { id: 'cp_vfd_100cv', nome: 'INVERSOR DE FREQUÊNCIA (VFD) 60CV A 100CV', peso: 28.00, perdaW: 750.0 },
    { id: 'cp_softstarter_60a', nome: 'SOFT-STARTER 15A A 60A', peso: 2.20, perdaW: 35.0 },
    { id: 'cp_softstarter_250a', nome: 'SOFT-STARTER 85A A 250A', peso: 7.80, perdaW: 90.0 },
    { id: 'cp_fonte_24v', nome: 'FONTE CHAVEADA 24VCC ATÉ 15A', peso: 1.00, perdaW: 15.0 },
    { id: 'cp_clp_remota', nome: 'CLP / MÓDULO I/O REMOTO', peso: 0.60, perdaW: 12.0 },
    { id: 'cp_multimetro', nome: 'MULTÍMETRO DIGITAL / MEDIDOR 96X96', peso: 0.40, perdaW: 5.0 }
  ],
  chapas: [
    { id: 'ch_19', nome: 'Chapa #19 [1.0mm]', espessura: 1.0 },
    { id: 'ch_16', nome: 'Chapa #16 [1.5mm]', espessura: 1.5 },
    { id: 'ch_14', nome: 'Chapa #14 [1.9mm]', espessura: 1.9 },
    { id: 'ch_12', nome: 'Chapa #12 [2.7mm]', espessura: 2.7 },
    { id: 'ch_11', nome: 'Chapa #11 [3.0mm]', espessura: 3.0 }
  ]
};

const DEFAULT_R026_PROJETISTAS_SEED = [
  { id: 'p1', nome: 'WILLIAN PESSOA', email: 'projetoeletrico1@gimi.com.br' },
  { id: 'p2', nome: 'KELVIN MARQUES', email: 'projetoeletrico2@gimi.com.br' },
  { id: 'p3', nome: 'WALTHER MENEZES', email: 'projetoeletrico3@gimi.com.br' },
  { id: 'p4', nome: 'THAYLA NITHELY', email: 'projetoeletrico4@gimi.com.br' },
  { id: 'p5', nome: 'PATRICK SANTOS', email: 'projetoeletrico5@gimi.com.br' },
  { id: 'p6', nome: 'MATEUS RIBEIRO', email: 'projetoeletrico6@gimi.com.br' },
  { id: 'p7', nome: 'FELIPE RAMOS', email: 'projetoeletrico7@gimi.com.br' },
  { id: 'p8', nome: 'GERALDO SANTOS', email: 'projetoeletrico8@gimi.com.br' },
  { id: 'p9', nome: 'CLAUDINEI FERREIRA', email: 'projetoeletrico9@gimi.com.br' },
  { id: 'p10', nome: 'GUSTAVO AUGUSTO', email: 'projetoeletrico10@gimi.com.br' },
  { id: 'p11', nome: 'BRUNO FERREIRA LIMA', email: 'projetoeletrico11@gimi.com.br' },
  { id: 'p12', nome: 'WEBER FERNANDES', email: 'projetoeletrico12@gimi.com.br' },
  { id: 'p13', nome: 'RODRIGO RIBEIRO', email: 'projetoeletrico13@gimi.com.br' },
  { id: 'p14', nome: 'PATRICK MONTEIRO', email: 'projetoeletrico14@gimi.com.br' },
  { id: 'p15', nome: 'SEBASTIÃO XIMENES', email: 'projetoeletrico15@gimi.com.br' },
  { id: 'p16', nome: 'BRUNO SILVA', email: 'projetoeletrico16@gimi.com.br' },
  { id: 'p17', nome: 'CLAUDIO BRANDÃO', email: 'projetoeletrico17@gimi.com.br' },
  { id: 'p18', nome: 'LUCAS LOPES', email: 'projetoeletrico18@gimi.com.br' },
  { id: 'p19', nome: 'MAILSON GOMES', email: 'projetoeletrico19@gimi.com.br' }
].sort((a, b) => a.nome.localeCompare(b.nome));

const DEFAULT_R026_EMAILS_SEED: Record<string, { destinatarios: string[]; interessados: string[] }> = {
  MECANICO: {
    destinatarios: [
      'projetomecanico1@gimi.com.br',
      'projetomecanico2@gimi.com.br',
      'projetomecanico3@gimi.com.br',
      'projetomecanico4@gimi.com.br',
      'projetomecanico5@gimi.com.br',
      'projetomecanico6@gimi.com.br',
      'projetomecanico7@gimi.com.br',
      'projetomecanico8@gimi.com.br',
      'projetomecanico9@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br'
    ]
  },
  FABRICA: {
    destinatarios: [
      'me1@gimi.com.br',
      'm2@gimi.com.br',
      'me3@gimi.com.br',
      'mp1@gimi.com.br',
      'pcp1@gimi.com.br',
      'pcp5@gimi.com.br',
      'pcm1@gimi.com.br',
      'recebimento1@gimi.com.br',
      'estoque1@gimi.com.br',
      'funilaria@gimi.com.br',
      'industrial1@gimi.com.br',
      'projetomecanico1@gimi.com.br',
      'projetomecanico2@gimi.com.br',
      'projetomecanico3@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br',
      'contratos1@gimi.com.br',
      'contratos2@gimi.com.br',
      'contratos3@gimi.com.br',
      'contratos4@gimi.com.br',
      'contratos5@gimi.com.br',
      'contratos6@gimi.com.br',
      'contratos2@gimiservice.com.br',
      'almoxarifado1@gimibonomi.com.br',
      'almoxarifado1@grupogimi.com.br'
    ]
  },
  'SUBSTITUIÇÃO': {
    destinatarios: [
      'me1@gimi.com.br',
      'm2@gimi.com.br',
      'me3@gimi.com.br',
      'mp1@gimi.com.br',
      'pcp1@gimi.com.br',
      'pcp5@gimi.com.br',
      'pcm1@gimi.com.br',
      'recebimento1@gimi.com.br',
      'estoque1@gimi.com.br',
      'funilaria@gimi.com.br',
      'industrial1@gimi.com.br',
      'projetomecanico1@gimi.com.br',
      'projetomecanico2@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br',
      'contratos1@gimi.com.br',
      'contratos2@gimi.com.br',
      'contratos3@gimi.com.br',
      'contratos4@gimi.com.br',
      'contratos5@gimi.com.br',
      'contratos6@gimi.com.br'
    ]
  },
  PARALIZADO: {
    destinatarios: [
      'me1@gimi.com.br',
      'm2@gimi.com.br',
      'me3@gimi.com.br',
      'mp1@gimi.com.br',
      'pcp1@gimi.com.br',
      'pcp5@gimi.com.br',
      'pcm1@gimi.com.br',
      'recebimento1@gimi.com.br',
      'estoque1@gimi.com.br',
      'funilaria@gimi.com.br',
      'industrial1@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br',
      'contratos1@gimi.com.br',
      'contratos2@gimi.com.br'
    ]
  }
};

const DEFAULT_R026_HISTORICO_SEED = [
  { id: 1, data: '2026-09-15', projetista: 'PATRICK MONTEIRO', processo: 'F-1908', itens: '40,48,55,68,78', rev: '01,02', tipo: 'FABRICA', obs: 'FABRICAÇÃO LIBERADA COM SUCESSO', emailStatus: 'E-mail Enviado' },
  { id: 2, data: '2026-09-14', projetista: 'PATRICK MONTEIRO', processo: 'F-1908', itens: '05,12,15,16,17', rev: '01,02', tipo: 'SUBSTITUIÇÃO', obs: 'Troca dos dimensionais para comportar cabos de entrada do cliente', emailStatus: 'E-mail Enviado' },
  { id: 3, data: '2026-09-11', projetista: 'PATRICK SANTOS', processo: 'F-1976', itens: '1,2', rev: '1', tipo: 'FABRICA', obs: 'ATENÇÃO AO ACOPLAMENTO DO QGBT', emailStatus: 'E-mail Enviado' },
  { id: 4, data: '2026-09-10', projetista: 'BRUNO FERREIRA LIMA', processo: 'F-2201', itens: '1,2,3', rev: '0', tipo: 'MECANICO', obs: 'ITENS 2 E 3 SÃO AS CAIXAS AUMENTADAS DO PROCESSO 16595', emailStatus: 'E-mail Enviado' },
  { id: 5, data: '2026-08-28', projetista: 'BRUNO FERREIRA LIMA', processo: 'F-1714', itens: '1,3,4,5,6,7', rev: '3,2,1', tipo: 'PARALIZADO', obs: 'EM REVISÃO SOLICITADO PELO CLIENTE (HOLD)', emailStatus: 'E-mail Enviado' }
];

const DEFAULT_ARMARIO_CONFIG = {
  obra: '',
  cliente: '',
  projetista: '',
  revisao: '',
  data: '',
  globalTuboTermo: false,
  djg1: {
    ativo: false,
    tag: 'DJG-1 (Entrada Principal)',
    entrada: '',
    inA: '',
    fases: '',
    barrasPorFase: '',
    comprimentoMm: '',
    perfil: '',
    tuboTermo: false,
    tuboCodigo: ''
  },
  djg2: {
    ativo: false,
    tag: 'DJG-2 (Entrada Secundária)',
    entrada: '',
    inA: '',
    fases: '',
    barrasPorFase: '',
    comprimentoMm: '',
    perfil: '',
    tuboTermo: false,
    tuboCodigo: ''
  },
  bg: {
    tag: 'Barra Geral (BG)',
    inA: '',
    fases: '',
    barrasPorFase: '',
    comprimentoMm: '',
    perfil: '',
    tuboTermo: false,
    tuboCodigo: ''
  },
  bn: {
    tag: 'Barra Neutro (BN)',
    inA: '',
    fases: '',
    barrasPorFase: '',
    comprimentoMm: '',
    perfil: '',
    tuboTermo: false,
    tuboCodigo: ''
  },
  bt: {
    tag: 'Barra Terra (BT / PE)',
    inA: '',
    fases: '',
    barrasPorFase: '',
    comprimentoMm: '',
    perfil: '',
    tuboTermo: false,
    tuboCodigo: ''
  },
  disjuntoresBarras: [],
  disjuntoresCabos: [],
  observacoes: ''
};

function isAdminUser(nomeOrKey: string): boolean {
  if (!nomeOrKey) return false;
  let decoded = nomeOrKey;
  try {
    decoded = decodeURIComponent(nomeOrKey);
  } catch {
    decoded = nomeOrKey;
  }
  const clean = decoded.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  return (
    clean === 'patrick monteiro' ||
    clean === 'felipe ramos' ||
    clean === 'william pessoa'
  );
}

function normalizeToolCategoria(cat?: string): string {
  const clean = String(cat || '').trim().toLowerCase();
  if (clean === 'ferramentas-auxiliares' || clean === 'ferramentas auxiliares') {
    return 'ferramentas';
  }
  return clean || 'ferramentas';
}

function readJsonSafe(filePath: string): any | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (!raw) return null;
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Aviso: falha ao ler JSON em ${filePath}:`, err);
  }
  return null;
}

function convertUsersInputToArray(rawUsers: any): HubUserRecord[] {
  const list: HubUserRecord[] = [];
  const seenKeys = new Set<string>();

  if (Array.isArray(rawUsers)) {
    for (const u of rawUsers) {
      if (!u || typeof u !== 'object') continue;
      const key = String(u.key || normalizeUserKey(u.nome || '')).trim();
      if (!key || LEGACY_REMOVED_USER_KEYS.has(key) || seenKeys.has(key)) continue;
      seenKeys.add(key);
      const profile = normalizeServerAccessProfile(u.perfilAcesso);
      list.push({
        key,
        nome: String(u.nome || key),
        cargo: String(u.cargo || (u.role === 'admin' ? 'Administrador' : 'Projetista Elétrico')),
        ...(profile ? { perfilAcesso: profile } : {}),
        role: u.role === 'admin' ? 'admin' : 'user',
        ...(u.senha ? { senha: String(u.senha) } : {}),
        favoritos: Array.isArray(u.favoritos) ? Array.from(new Set(u.favoritos.map(String))) : []
      });
    }
  } else if (rawUsers && typeof rawUsers === 'object') {
    for (const [keyRaw, u] of Object.entries(rawUsers) as [string, any][]) {
      if (!u || typeof u !== 'object') continue;
      const key = String(keyRaw).trim();
      if (!key || LEGACY_REMOVED_USER_KEYS.has(key) || seenKeys.has(key)) continue;
      seenKeys.add(key);
      const profile = normalizeServerAccessProfile(u.perfilAcesso);
      list.push({
        key,
        nome: String(u.nome || key),
        cargo: String(u.cargo || (u.role === 'admin' ? 'Administrador' : 'Projetista Elétrico')),
        ...(profile ? { perfilAcesso: profile } : {}),
        role: u.role === 'admin' ? 'admin' : 'user',
        ...(u.senha ? { senha: String(u.senha) } : {}),
        favoritos: Array.isArray(u.favoritos) ? Array.from(new Set(u.favoritos.map(String))) : []
      });
    }
  }

  return list;
}

function ensureMasterAdminSafeguards(users: HubUserRecord[]): boolean {
  let changed = false;
  const masterAdmins: Array<{ key: string; nome: string; cargo: string; senha: string }> = [
    { key: 'patrick-monteiro', nome: 'Patrick Monteiro', cargo: 'Projetista Elétrico', senha: 'PE14@GSQA' },
    { key: 'felipe-ramos', nome: 'Felipe Ramos', cargo: 'Líder', senha: 'PE07@GSQA' },
    { key: 'william-pessoa', nome: 'William Pessoa', cargo: 'Gestor', senha: 'PE01@GSQA' }
  ];

  for (const adm of masterAdmins) {
    const existing = users.find((u) => u.key === adm.key);
    if (!existing) {
      const def = DEFAULT_USERS[adm.key];
      users.push({
        key: adm.key,
        nome: adm.nome,
        cargo: adm.cargo,
        role: 'admin',
        senha: adm.senha,
        favoritos: def ? [...def.favoritos] : ['app-gimix', 'central-r026']
      });
      changed = true;
    } else {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        changed = true;
      }
      if (!existing.senha) {
        existing.senha = adm.senha;
        changed = true;
      }
    }
  }
  return changed;
}

function normalizeProjetosStore(raw: any): ProjetosStore {
  const activeDraft = raw && typeof raw === 'object' && raw.activeDraft && typeof raw.activeDraft === 'object'
    ? raw.activeDraft
    : null;
  const projetos: Record<string, { id: string; nome: string; updatedAt: string; data: any }> = {};
  if (raw && typeof raw === 'object' && raw.projetos && typeof raw.projetos === 'object' && !Array.isArray(raw.projetos)) {
    for (const [k, v] of Object.entries(raw.projetos) as [string, any][]) {
      if (v && typeof v === 'object' && v.data) {
        projetos[k] = {
          id: String(v.id || k),
          nome: String(v.nome || k),
          updatedAt: String(v.updatedAt || new Date().toISOString()),
          data: v.data
        };
      }
    }
  }
  return { activeDraft, projetos };
}

function normalizeToolsListServer(rawTools: any[], deletedSet: Set<string>): any[] {
  const legacyChapariaIds = new Set(['calc-pesos', 'config-chaparia']);
  const legacyEletricaIds = new Set(['calc-capacitores', 'estudo-cascata', 'estudo-cascateamento']);

  return rawTools
    .filter((t: any) => t && t.id && !legacyChapariaIds.has(t.id) && !legacyEletricaIds.has(t.id) && !deletedSet.has(String(t.id)))
    .map((t: any) => {
      const cleaned = { ...t, categoria: normalizeToolCategoria(t.categoria || t.pasta) };
      delete cleaned.categoriasExtras;
      if (cleaned.id === 'chaparia-com-chapa' && cleaned.titulo === 'Chaparia é com o Chapa') {
        cleaned.titulo = 'Suíte Mecânica';
        cleaned.descricao = 'Ambiente unificado de engenharia mecânica: parametrização e busca reversa de chaparia, cálculo de peso acumulado de quadros/barramentos e gestão de estruturas. Módulo expansível: novas ferramentas e cubículos serão integrados em breve.';
        cleaned.fala = '<b>Suíte Mecânica!</b> Ambiente unificado de engenharia mecânica com Configurador de Chaparia, Calculadora de Pesos e Banco Permanente sincronizado em rede!';
        cleaned.orbitLabel = '🔧⚖️ SUÍTE MECÂNICA';
      }
      if (cleaned.id === 'eletrica-protecao' && cleaned.titulo === 'Suíte Elétrica & Proteção') {
        cleaned.titulo = 'Suíte Elétrica';
        cleaned.descricao = 'Ambiente unificado de engenharia elétrica: cálculo de coordenação e seletividade técnica (cascateamento WEG/ABB) e dimensionamento analítico de bancos de capacitores. Módulo expansível: novas rotinas e dimensionamentos em desenvolvimento para adição contínua.';
        cleaned.fala = '<b>Suíte Elétrica!</b> Coordenação de cascateamento WEG/ABB e dimensionamento analítico de bancos de capacitores sincronizados no servidor com o Promete!';
        cleaned.orbitLabel = '⚡🛡️ SUÍTE ELÉTRICA';
      }
      return cleaned;
    });
}

let cachedMasterDb: MasterDatabase | null = null;

function saveMasterDatabase(db: MasterDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db.deleted_ids = Array.from(new Set((db.deleted_ids || []).map((id) => String(id).trim()).filter(Boolean)));
    db.meta = {
      version: db.meta?.version || '3.0.0',
      updatedAt: new Date().toISOString()
    };

    const jsonPayload = JSON.stringify(db, null, 2);

    // Escrita atômica: grava .tmp, preserva .bak da versão anterior (ou atual), renomeia .tmp -> gimi_master_db.json
    fs.writeFileSync(MASTER_DB_TMP_FILE, jsonPayload, 'utf-8');
    if (fs.existsSync(MASTER_DB_FILE)) {
      try {
        fs.copyFileSync(MASTER_DB_FILE, MASTER_DB_BAK_FILE);
      } catch {
        fs.writeFileSync(MASTER_DB_BAK_FILE, jsonPayload, 'utf-8');
      }
    } else {
      fs.writeFileSync(MASTER_DB_BAK_FILE, jsonPayload, 'utf-8');
    }
    fs.renameSync(MASTER_DB_TMP_FILE, MASTER_DB_FILE);
    cachedMasterDb = db;
  } catch (err) {
    console.error('Erro na escrita atômica do gimi_master_db.json, tentando gravação direta:', err);
    try {
      const jsonPayload = JSON.stringify(db, null, 2);
      fs.writeFileSync(MASTER_DB_FILE, jsonPayload, 'utf-8');
      fs.writeFileSync(MASTER_DB_BAK_FILE, jsonPayload, 'utf-8');
      cachedMasterDb = db;
    } catch (innerErr) {
      console.error('Erro crítico ao salvar gimi_master_db.json:', innerErr);
    }
  }
}

function initMasterDatabase(): MasterDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const masterExists = fs.existsSync(MASTER_DB_FILE);
  const backupExists = fs.existsSync(MASTER_DB_BAK_FILE);

  // ==========================================================
  // BOOT GUARD (RAMO A): Banco Mestre já existe — NUNCA sobrescrever!
  // ==========================================================
  if (masterExists || backupExists) {
    let parsed = masterExists ? readJsonSafe(MASTER_DB_FILE) : null;
    let recoveredFromBackup = false;

    if (!parsed || typeof parsed !== 'object') {
      console.warn('⚠️ [Boot Guard] gimi_master_db.json ilegível ou corrompido. Recuperando de gimi_master_db.json.bak...');
      parsed = backupExists ? readJsonSafe(MASTER_DB_BAK_FILE) : null;
      recoveredFromBackup = Boolean(parsed && typeof parsed === 'object');
    }

    if (parsed && typeof parsed === 'object') {
      let needsStructuralSave = recoveredFromBackup;

      const deletedIds = Array.isArray(parsed.deleted_ids)
        ? Array.from(new Set(parsed.deleted_ids.map((id: any) => String(id).trim()).filter(Boolean)))
        : [];
      if (!Array.isArray(parsed.deleted_ids)) needsStructuralSave = true;
      const deletedSet = new Set(deletedIds);

      if (!parsed.meta || typeof parsed.meta !== 'object') needsStructuralSave = true;
      if (!parsed.hub_permissions || typeof parsed.hub_permissions !== 'object') needsStructuralSave = true;
      if (!Array.isArray(parsed.hub_users)) needsStructuralSave = true;
      if (!Array.isArray(parsed.banco_componentes)) needsStructuralSave = true;
      if (!Array.isArray(parsed.banco_quadros_custom)) needsStructuralSave = true;
      if (!Array.isArray(parsed.banco_armarios_custom)) needsStructuralSave = true;
      if (!Array.isArray(parsed.banco_almofadas_custom)) needsStructuralSave = true;
      if (!parsed.projetos_conexoes || typeof parsed.projetos_conexoes !== 'object') needsStructuralSave = true;
      if (!parsed.projetos_mecanica || typeof parsed.projetos_mecanica !== 'object') needsStructuralSave = true;
      if (!Array.isArray(parsed.hub_tools)) needsStructuralSave = true;
      if (!parsed.pesos_outros || typeof parsed.pesos_outros !== 'object') needsStructuralSave = true;
      if (!parsed.eletrica || typeof parsed.eletrica !== 'object') needsStructuralSave = true;
      if (!parsed.r026 || typeof parsed.r026 !== 'object') needsStructuralSave = true;
      if (!parsed.conexoes_base || typeof parsed.conexoes_base !== 'object') needsStructuralSave = true;

      const hubUsers = Array.isArray(parsed.hub_users)
        ? convertUsersInputToArray(parsed.hub_users)
        : convertUsersInputToArray(DEFAULT_USERS);

      if (ensureMasterAdminSafeguards(hubUsers)) {
        needsStructuralSave = true;
      }

      const rawTools = Array.isArray(parsed.hub_tools) ? parsed.hub_tools : DEFAULT_TOOLS.map((t) => ({ ...t }));
      const toolsList = normalizeToolsListServer(rawTools, deletedSet);

      const db: MasterDatabase = {
        meta: {
          version: String(parsed.meta?.version || '3.0.0'),
          updatedAt: String(parsed.meta?.updatedAt || new Date().toISOString())
        },
        hub_permissions: normalizePermissionsMapServer(parsed.hub_permissions),
        hub_users: hubUsers,
        banco_componentes: (Array.isArray(parsed.banco_componentes) ? parsed.banco_componentes : [])
          .filter((i: any) => i && !deletedSet.has(String(i.id))),
        banco_quadros_custom: (Array.isArray(parsed.banco_quadros_custom) ? parsed.banco_quadros_custom : [])
          .filter((i: any) => i && !deletedSet.has(String(i.id))),
        banco_armarios_custom: (Array.isArray(parsed.banco_armarios_custom) ? parsed.banco_armarios_custom : [])
          .filter((i: any) => i && !deletedSet.has(String(i.id))),
        banco_almofadas_custom: (Array.isArray(parsed.banco_almofadas_custom) ? parsed.banco_almofadas_custom : [])
          .filter((i: any) => i && !deletedSet.has(String(i.id))),
        deleted_ids: deletedIds,
        projetos_conexoes: normalizeProjetosStore(parsed.projetos_conexoes),
        projetos_mecanica: normalizeProjetosStore(parsed.projetos_mecanica),
        hub_tools: toolsList,
        migrations: parsed.migrations && typeof parsed.migrations === 'object' ? { ...parsed.migrations } : { pfannenbergPssAdded: true },
        pesos_outros: {
          cubiculotraf: (Array.isArray(parsed.pesos_outros?.cubiculotraf) ? parsed.pesos_outros.cubiculotraf : [])
            .filter((i: any) => i && !deletedSet.has(String(i.id))),
          cabinebarramento: (Array.isArray(parsed.pesos_outros?.cabinebarramento) ? parsed.pesos_outros.cabinebarramento : [])
            .filter((i: any) => i && !deletedSet.has(String(i.id))),
          simplificada: (Array.isArray(parsed.pesos_outros?.simplificada) ? parsed.pesos_outros.simplificada : [])
            .filter((i: any) => i && !deletedSet.has(String(i.id))),
          chapas: (Array.isArray(parsed.pesos_outros?.chapas) ? parsed.pesos_outros.chapas : DEFAULT_PESOS_SEED.chapas.map((c) => ({ ...c })))
            .filter((i: any) => i && !deletedSet.has(String(i.id)))
        },
        eletrica: {
          capacitores: (Array.isArray(parsed.eletrica?.capacitores) ? parsed.eletrica.capacitores : [])
            .filter((i: any) => i && !deletedSet.has(String(i.id))),
          dimensionamentos: Array.isArray(parsed.eletrica?.dimensionamentos) ? parsed.eletrica.dimensionamentos : [],
          cascateamento: (Array.isArray(parsed.eletrica?.cascateamento) ? parsed.eletrica.cascateamento : [])
            .filter((i: any) => i && !deletedSet.has(String(i.id)))
        },
        r026: {
          emails: parsed.r026?.emails && typeof parsed.r026.emails === 'object' ? parsed.r026.emails : JSON.parse(JSON.stringify(DEFAULT_R026_EMAILS_SEED)),
          projetistas: Array.isArray(parsed.r026?.projetistas) ? parsed.r026.projetistas : JSON.parse(JSON.stringify(DEFAULT_R026_PROJETISTAS_SEED)),
          historico: Array.isArray(parsed.r026?.historico) ? parsed.r026.historico : JSON.parse(JSON.stringify(DEFAULT_R026_HISTORICO_SEED))
        },
        conexoes_base: {
          terminais: Array.isArray(parsed.conexoes_base?.terminais) ? parsed.conexoes_base.terminais : [],
          barramentos_nominais: Array.isArray(parsed.conexoes_base?.barramentos_nominais) ? parsed.conexoes_base.barramentos_nominais : [],
          tubos_termocontrateis_tabela: Array.isArray(parsed.conexoes_base?.tubos_termocontrateis_tabela) ? parsed.conexoes_base.tubos_termocontrateis_tabela : []
        }
      };

      if (needsStructuralSave) {
        saveMasterDatabase(db);
      } else {
        cachedMasterDb = db;
      }
      console.log(`🛡️ [Boot Guard] Banco Mestre carregado com integridade de ./data/gimi_master_db.json (${db.hub_users.length} usuários, ${db.banco_componentes.length} componentes, ${db.deleted_ids.length} expurgos).`);
      return db;
    }
  }

  // ==========================================================
  // PRIMEIRA EXECUÇÃO LIMPA (RAMO B): Migra dados legados existentes para gimi_master_db.json
  // ==========================================================
  console.log('🚀 [Boot Guard] Primeira execução sem gimi_master_db.json — consolidando bases legadas...');

  const legacyPortal = readJsonSafe(LEGACY_DB_FILE);
  const legacyPesos = readJsonSafe(LEGACY_PESOS_DB_FILE);
  const legacyCap = readJsonSafe(LEGACY_CAPACITORES_DB_FILE);
  const legacyCasc = readJsonSafe(LEGACY_CASCATEAMENTO_DB_FILE);
  const legacyR026Emails = readJsonSafe(LEGACY_R026_EMAILS_FILE);
  const legacyR026Hist = readJsonSafe(LEGACY_R026_HISTORICO_FILE) ?? readJsonSafe(LEGACY_R026_LEGACY_HISTORICO_FILE);
  const legacyConexoes = readJsonSafe(LEGACY_CONEXOES_DB_FILE);
  const legacyArmario = readJsonSafe(LEGACY_ARMARIO_CONFIG_FILE);

  const hubUsers = legacyPortal?.users
    ? convertUsersInputToArray(legacyPortal.users)
    : convertUsersInputToArray(DEFAULT_USERS);
  ensureMasterAdminSafeguards(hubUsers);

  const rawTools = Array.isArray(legacyPortal?.tools) ? legacyPortal.tools : DEFAULT_TOOLS.map((t) => ({ ...t }));
  const toolsList = normalizeToolsListServer(rawTools, new Set());
  const migrations: Record<string, boolean> = legacyPortal?.migrations && typeof legacyPortal.migrations === 'object'
    ? { ...legacyPortal.migrations }
    : { pfannenbergPssAdded: true };

  if (!migrations.pfannenbergPssAdded) {
    if (!toolsList.some((t: any) => t.id === 'pfannenberg-pss')) {
      const defPf = DEFAULT_TOOLS.find((t) => t.id === 'pfannenberg-pss');
      if (defPf) {
        const idxCon = toolsList.findIndex((t: any) => t.id === 'conexoes-barramentos');
        if (idxCon >= 0) toolsList.splice(idxCon + 1, 0, { ...defPf });
        else toolsList.push({ ...defPf });
      }
    }
    migrations.pfannenbergPssAdded = true;
  }

  const quadrosSobrepor = Array.isArray(legacyPesos?.quadros?.SOBREPOR)
    ? legacyPesos.quadros.SOBREPOR.map((q: any) => ({ ...q, tipo: q.tipo || 'SOBREPOR' }))
    : [];
  const quadrosEmbutir = Array.isArray(legacyPesos?.quadros?.EMBUTIR)
    ? legacyPesos.quadros.EMBUTIR.map((q: any) => ({ ...q, tipo: q.tipo || 'EMBUTIR' }))
    : [];

  const cascRaw = Array.isArray(legacyCasc)
    ? legacyCasc
    : Array.isArray(legacyCasc?.cascateamento)
      ? legacyCasc.cascateamento
      : [];

  const histRaw = Array.isArray(legacyR026Hist)
    ? legacyR026Hist
    : Array.isArray(legacyR026Hist?.historico)
      ? legacyR026Hist.historico
      : JSON.parse(JSON.stringify(DEFAULT_R026_HISTORICO_SEED));

  const hasLegacyArmarioData = Boolean(
    legacyArmario &&
    typeof legacyArmario === 'object' &&
    (legacyArmario.obra || legacyArmario.cliente || legacyArmario.djg1?.ativo || legacyArmario.djg2?.ativo ||
      legacyArmario.bg?.inA || (Array.isArray(legacyArmario.disjuntoresBarras) && legacyArmario.disjuntoresBarras.length > 0) ||
      (Array.isArray(legacyArmario.disjuntoresCabos) && legacyArmario.disjuntoresCabos.length > 0))
  );

  const initialMasterDb: MasterDatabase = {
    meta: { version: '3.0.0', updatedAt: new Date().toISOString() },
    hub_permissions: normalizePermissionsMapServer(legacyPortal?.permissions),
    hub_users: hubUsers,
    banco_componentes: Array.isArray(legacyPesos?.componentes)
      ? legacyPesos.componentes
      : DEFAULT_PESOS_SEED.componentes.map((c) => ({ ...c })),
    banco_quadros_custom: [...quadrosSobrepor, ...quadrosEmbutir],
    banco_armarios_custom: Array.isArray(legacyPesos?.armario) ? legacyPesos.armario : [],
    banco_almofadas_custom: Array.isArray(legacyPesos?.almofadas_laterais) ? legacyPesos.almofadas_laterais : [],
    deleted_ids: [],
    projetos_conexoes: {
      activeDraft: hasLegacyArmarioData ? legacyArmario : null,
      projetos: {}
    },
    projetos_mecanica: {
      activeDraft: null,
      projetos: {}
    },
    hub_tools: toolsList,
    migrations,
    pesos_outros: {
      cubiculotraf: Array.isArray(legacyPesos?.cubiculotraf) ? legacyPesos.cubiculotraf : [],
      cabinebarramento: Array.isArray(legacyPesos?.cabinebarramento) ? legacyPesos.cabinebarramento : [],
      simplificada: Array.isArray(legacyPesos?.simplificada) ? legacyPesos.simplificada : [],
      chapas: Array.isArray(legacyPesos?.chapas)
        ? legacyPesos.chapas
        : DEFAULT_PESOS_SEED.chapas.map((c) => ({ ...c }))
    },
    eletrica: {
      capacitores: Array.isArray(legacyCap?.capacitores) ? legacyCap.capacitores : [],
      dimensionamentos: Array.isArray(legacyCap?.dimensionamentos) ? legacyCap.dimensionamentos : [],
      cascateamento: cascRaw.map((item: any, idx: number) => ({
        id: item.id || `casc_${idx + 1}`,
        fabricante: item.fabricante,
        tensao: item.tensao,
        montante: item.montante,
        jusante: item.jusante,
        icc: item.icc,
        obs: item.obs || ''
      }))
    },
    r026: {
      emails: legacyR026Emails?.emails && typeof legacyR026Emails.emails === 'object'
        ? legacyR026Emails.emails
        : JSON.parse(JSON.stringify(DEFAULT_R026_EMAILS_SEED)),
      projetistas: Array.isArray(legacyR026Emails?.projetistas)
        ? legacyR026Emails.projetistas
        : JSON.parse(JSON.stringify(DEFAULT_R026_PROJETISTAS_SEED)),
      historico: histRaw
    },
    conexoes_base: {
      terminais: Array.isArray(legacyConexoes?.terminais) ? legacyConexoes.terminais : [],
      barramentos_nominais: Array.isArray(legacyConexoes?.barramentos_nominais) ? legacyConexoes.barramentos_nominais : [],
      tubos_termocontrateis_tabela: Array.isArray(legacyConexoes?.tubos_termocontrateis_tabela) ? legacyConexoes.tubos_termocontrateis_tabela : []
    }
  };

  saveMasterDatabase(initialMasterDb);
  return initialMasterDb;
}

function getMasterDatabase(): MasterDatabase {
  if (!cachedMasterDb) {
    return initMasterDatabase();
  }
  return cachedMasterDb;
}

// Inicializa o banco mestre único com Boot Guard imediatamente na subida do servidor
initMasterDatabase();

function findHubUser(db: MasterDatabase, keyOrName: string): HubUserRecord | undefined {
  const clean = String(keyOrName || '').trim();
  if (!clean) return undefined;
  return db.hub_users.find((u) => u.key === clean) ||
    db.hub_users.find((u) => normalizeUserKey(u.key) === normalizeUserKey(clean) || normalizeUserKey(u.nome) === normalizeUserKey(clean));
}

function formatHubUserSummary(u: HubUserRecord) {
  return {
    key: u.key,
    nome: u.nome,
    cargo: u.cargo || (u.role === 'admin' ? 'Administrador' : 'Projetista Elétrico'),
    perfilAcesso: normalizeServerAccessProfile(u.perfilAcesso),
    role: u.role || 'user',
    hasPassword: Boolean(u.senha) || isAdminUser(u.key) || isAdminUser(u.nome),
    favoritosCount: (u.favoritos || []).length,
    isMasterAdmin: u.key === 'patrick-monteiro' || u.key === 'felipe-ramos' || u.key === 'william-pessoa'
  };
}

function hasAdminPermission(req: express.Request, db?: MasterDatabase): boolean {
  const rawName = (req.headers['x-user-name'] as string) || '';
  const rawKey = (req.headers['x-user-key'] as string) || '';
  let decodedName = rawName;
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    decodedName = rawName;
  }

  if (isAdminUser(decodedName) || isAdminUser(rawKey)) {
    return true;
  }

  const master = db || getMasterDatabase();
  if (rawKey) {
    const byKey = findHubUser(master, rawKey);
    if (byKey?.role === 'admin') return true;
  }
  const normKey = normalizeUserKey(decodedName);
  if (normKey) {
    const byName = findHubUser(master, normKey);
    if (byName?.role === 'admin') return true;
  }
  return false;
}

function normalizeCategoriaServer(cat?: string): string {
  const clean = String(cat || '').trim().toLowerCase();
  if (clean === 'ferramentas-auxiliares' || clean === 'ferramentas auxiliares') {
    return 'ferramentas';
  }
  return clean || 'ferramentas';
}

// ==========================================
// ROTAS DA API REST DO PORTAL (/api/tools e /api/ferramentas)
// ==========================================

// 1. Obter todas as ferramentas sincronizadas
const handleGetTools = (_req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  const deletedSet = new Set(db.deleted_ids);
  res.status(200).json({
    success: true,
    tools: db.hub_tools.filter((t: any) => t && !deletedSet.has(String(t.id)))
  });
};
app.get('/api/tools', handleGetTools);
app.get('/api/ferramentas', handleGetTools);

// 2. Cadastrar nova ferramenta (Apenas Admins)
const handleCreateTool = (req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores autorizados podem cadastrar ferramentas.'
    });
  }

  const { titulo, categoria, pasta, badge, url, descricao, fala, actionText, bloqueado } = req.body;
  if (!titulo || !url) {
    return res.status(400).json({ success: false, message: 'Título e URL são obrigatórios.' });
  }

  const novaFerramenta = {
    id: 'tool-' + Date.now(),
    titulo: String(titulo).trim(),
    categoria: normalizeCategoriaServer(categoria || pasta || 'ferramentas'),
    badge: String(badge || '').trim() || 'Ativo',
    url: String(url).trim(),
    descricao: String(descricao || '').trim() || 'Ferramenta adicionada ao portal de engenharia.',
    fala: String(fala || '').trim() || `<b>${String(titulo).trim()}.</b> Atalho cadastrado no portal GIMI.`,
    actionText: String(actionText || '').trim() || 'Abrir Ferramenta ↗',
    bloqueado: Boolean(bloqueado),
    isCustom: true
  };

  db.hub_tools = [novaFerramenta, ...db.hub_tools];
  db.deleted_ids = db.deleted_ids.filter((d) => d !== novaFerramenta.id);
  saveMasterDatabase(db);

  return res.status(200).json({ success: true, tool: novaFerramenta, tools: db.hub_tools });
};
app.post('/api/tools', handleCreateTool);
app.post('/api/ferramentas', handleCreateTool);

// 3. Atualizar ferramenta existente (Apenas Admins)
const handleUpdateToolRoute = (req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores autorizados podem editar ferramentas.'
    });
  }

  const targetId = String(req.params.id || req.body?.id || '').trim();
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'ID da ferramenta não informado.' });
  }

  const index = db.hub_tools.findIndex((t: any) => t.id === targetId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Ferramenta não encontrada no servidor.' });
  }

  const current = db.hub_tools[index];
  const nextCategoria =
    req.body.categoria !== undefined || req.body.pasta !== undefined
      ? normalizeCategoriaServer(req.body.categoria ?? req.body.pasta)
      : normalizeCategoriaServer(current.categoria);

  const updatedItem: any = {
    ...current,
    titulo: req.body.titulo !== undefined ? String(req.body.titulo).trim() : current.titulo,
    categoria: nextCategoria,
    badge: req.body.badge !== undefined ? String(req.body.badge).trim() : current.badge,
    url: req.body.url !== undefined ? String(req.body.url).trim() : current.url,
    descricao: req.body.descricao !== undefined ? String(req.body.descricao).trim() : current.descricao,
    fala: req.body.fala !== undefined ? String(req.body.fala).trim() : current.fala,
    actionText: req.body.actionText !== undefined ? String(req.body.actionText).trim() : current.actionText,
    bloqueado: req.body.bloqueado !== undefined ? Boolean(req.body.bloqueado) : Boolean(current.bloqueado)
  };
  delete updatedItem.categoriasExtras;

  db.hub_tools[index] = updatedItem;
  saveMasterDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Ferramenta atualizada e salva no servidor central com sucesso.',
    tool: db.hub_tools[index],
    tools: db.hub_tools
  });
};
app.put('/api/tools/:id', handleUpdateToolRoute);
app.put('/api/ferramentas/:id', handleUpdateToolRoute);
app.post('/api/tools/editar', handleUpdateToolRoute);
app.post('/api/ferramentas/editar', handleUpdateToolRoute);

// 4. Excluir ferramenta (Apenas Admins) — registra em deleted_ids para nunca retornar no boot
const handleDeleteToolRoute = (req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores autorizados podem excluir ferramentas.'
    });
  }

  const targetId = String(req.params.id || req.body?.id || '').trim();
  const filtered = db.hub_tools.filter((t: any) => t.id !== targetId);

  if (filtered.length === db.hub_tools.length) {
    return res.status(404).json({ success: false, message: 'Ferramenta não encontrada no servidor.' });
  }

  db.hub_tools = filtered;
  if (!db.deleted_ids.includes(targetId)) {
    db.deleted_ids.push(targetId);
  }
  if (db.hub_permissions && db.hub_permissions[targetId]) {
    delete db.hub_permissions[targetId];
  }

  // Remove o ID excluído das listas de favoritos dos usuários para não sobrar contador órfão
  for (const userObj of db.hub_users) {
    if (Array.isArray(userObj.favoritos)) {
      userObj.favoritos = userObj.favoritos.filter((favId: string) => favId !== targetId);
    }
  }

  saveMasterDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Ferramenta excluída permanentemente do servidor central.',
    tools: db.hub_tools,
    permissions: db.hub_permissions
  });
};
app.delete('/api/tools/:id', handleDeleteToolRoute);
app.delete('/api/ferramentas/:id', handleDeleteToolRoute);

// 5. Restaurar padrões de ferramentas originais (Apenas Admins)
const handleResetToolsRoute = (req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores autorizados podem restaurar padrões.'
    });
  }

  const defaultToolIds = new Set(DEFAULT_TOOLS.map((t) => t.id));
  db.deleted_ids = db.deleted_ids.filter((id) => !defaultToolIds.has(id));
  db.hub_tools = DEFAULT_TOOLS.map((t) => ({ ...t }));
  saveMasterDatabase(db);

  return res.status(200).json({ success: true, tools: db.hub_tools });
};
app.post('/api/tools/reset', handleResetToolsRoute);
app.post('/api/ferramentas/reset', handleResetToolsRoute);

// 5.1 Importar catálogo de ferramentas completo (Apenas Admins)
const handleImportToolsRoute = (req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem importar ferramentas.'
    });
  }

  const { tools } = req.body;
  if (!Array.isArray(tools) || tools.length === 0) {
    return res.status(400).json({ success: false, message: 'Lista de ferramentas inválida para importação.' });
  }

  const importedIds = new Set(tools.map((t: any) => String(t?.id || '').trim()).filter(Boolean));
  db.deleted_ids = db.deleted_ids.filter((id) => !importedIds.has(id));
  db.hub_tools = tools.map((t: any) => {
    const cleaned = { ...t, categoria: normalizeCategoriaServer(t.categoria || t.pasta) };
    delete cleaned.categoriasExtras;
    return cleaned;
  });
  saveMasterDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Ferramentas importadas e salvas no servidor central com sucesso!',
    tools: db.hub_tools
  });
};
app.post('/api/tools/import', handleImportToolsRoute);
app.post('/api/ferramentas/import', handleImportToolsRoute);

// 5.2 Matriz de Permissões e Visibilidade de Ferramentas (ACL)
const handleGetPermissions = (_req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  res.status(200).json({
    success: true,
    permissions: db.hub_permissions || {}
  });
};
app.get('/api/permissions', handleGetPermissions);
app.get('/api/tools/permissions', handleGetPermissions);

const handleSavePermissions = (req: express.Request, res: express.Response) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores autorizados podem alterar permissões das ferramentas.'
    });
  }

  const rawPermissions = req.body?.permissions;
  if (!rawPermissions || typeof rawPermissions !== 'object' || Array.isArray(rawPermissions)) {
    return res.status(400).json({
      success: false,
      message: 'Estrutura de permissões inválida.'
    });
  }

  db.hub_permissions = normalizePermissionsMapServer(rawPermissions);
  saveMasterDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Matriz de permissões salva e sincronizada no servidor!',
    permissions: db.hub_permissions
  });
};
app.put('/api/permissions', handleSavePermissions);
app.put('/api/tools/permissions', handleSavePermissions);
app.post('/api/permissions', handleSavePermissions);

// 6. Login / Identificação do Usuário (1 clique para Projetistas sem senha; validação de senha para Admins)
app.post('/api/login', (req, res) => {
  const { key: requestedKey, nome, senha } = req.body;
  if ((!nome || !String(nome).trim()) && (!requestedKey || !String(requestedKey).trim())) {
    return res.status(400).json({ success: false, message: 'Identificação do usuário é obrigatória.' });
  }

  const nomeFormatado = String(nome || '').trim();
  const db = getMasterDatabase();

  let user: HubUserRecord | undefined;

  if (requestedKey) {
    user = db.hub_users.find((u) => u.key === String(requestedKey).trim());
  }

  if (!user && nomeFormatado) {
    const normalizedKey = normalizeUserKey(nomeFormatado);
    user = db.hub_users.find((u) => u.key === normalizedKey);
  }

  if (!user && nomeFormatado) {
    const targetNorm = normalizeUserKey(nomeFormatado);
    user = db.hub_users.find((u) =>
      u.nome.trim().toLowerCase() === nomeFormatado.toLowerCase() ||
      normalizeUserKey(u.nome) === targetNorm ||
      normalizeUserKey(u.key) === targetNorm
    );
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuário não encontrado no cadastro do portal.'
    });
  }

  const userKey = user.key;
  const isMasterAdm = isAdminUser(user.nome) || isAdminUser(userKey);

  if (user.senha || isMasterAdm) {
    if (!senha || !String(senha).trim()) {
      return res.status(401).json({
        success: false,
        requirePassword: true,
        cargo: user.cargo,
        message: 'Este usuário administrativo requer senha para acessar o portal.'
      });
    }

    const passClean = String(senha).trim();
    const validPasswords = [user.senha];
    if (userKey === 'william-pessoa' || user.nome.toLowerCase() === 'william pessoa') {
      validPasswords.push('PE01@GSQA', 'WP01@GSQA', 'GESTOR@GSQA');
    }

    if (!validPasswords.filter(Boolean).includes(passClean)) {
      return res.status(401).json({
        success: false,
        requirePassword: true,
        message: 'Senha incorreta! Digite a senha cadastrada para este administrador.'
      });
    }
  }

  res.json({
    success: true,
    user: {
      key: userKey,
      nome: user.nome,
      cargo: user.cargo || (user.role === 'admin' ? 'Administrador' : 'Projetista Elétrico'),
      perfilAcesso: normalizeServerAccessProfile(user.perfilAcesso),
      role: user.role || 'user',
      favoritos: user.favoritos || []
    }
  });
});

// ==========================================
// ROTAS DE GESTÃO DE USUÁRIOS (Exclusivo para Admins)
// ==========================================

app.get('/api/users', (_req, res) => {
  const db = getMasterDatabase();
  const userList = db.hub_users.map(formatHubUserSummary);
  res.json({ success: true, users: userList });
});

app.post('/api/users', (req, res) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem cadastrar usuários.'
    });
  }

  const { nome, cargo, role, senha, perfilAcesso } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome do usuário é obrigatório.' });
  }

  const nomeTrim = nome.trim();
  const userKey = normalizeUserKey(nomeTrim);

  if (db.hub_users.some((u) => u.key === userKey)) {
    return res.status(400).json({
      success: false,
      message: 'Já existe um usuário cadastrado com esse nome/identificador.'
    });
  }

  const userRole: 'admin' | 'user' = role === 'admin' ? 'admin' : 'user';
  const normalizedProfile = normalizeServerAccessProfile(perfilAcesso);
  const novoUsuario: HubUserRecord = {
    key: userKey,
    nome: nomeTrim,
    cargo: cargo?.trim() || (userRole === 'admin' ? 'Administrador' : 'Projetista Elétrico'),
    ...(normalizedProfile ? { perfilAcesso: normalizedProfile } : {}),
    role: userRole,
    favoritos: ['app-gimix', 'central-r026', 'chaparia-com-chapa', 'eletrica-protecao']
  };

  if (senha && senha.trim()) {
    novoUsuario.senha = senha.trim();
  } else if (userRole === 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Usuários com perfil de Administrador devem ter uma senha cadastrada.'
    });
  }

  db.hub_users.push(novoUsuario);
  saveMasterDatabase(db);

  res.json({
    success: true,
    message: 'Usuário cadastrado com sucesso!',
    users: db.hub_users.map(formatHubUserSummary)
  });
});

app.put('/api/users/:userKey', (req, res) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem editar usuários.'
    });
  }

  const { userKey } = req.params;
  const userObj = db.hub_users.find((u) => u.key === userKey);

  if (!userObj) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  const { cargo, role, senha, perfilAcesso } = req.body;

  if ((userKey === 'patrick-monteiro' || userKey === 'felipe-ramos' || userKey === 'william-pessoa') && role && role !== 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Os administradores mestres (Patrick Monteiro, Felipe Ramos e William Pessoa) não podem ter seu papel alterado para Projetista.'
    });
  }

  if (cargo !== undefined) {
    userObj.cargo = cargo.trim();
  }

  if (perfilAcesso !== undefined) {
    const normalizedProfile = normalizeServerAccessProfile(perfilAcesso);
    if (normalizedProfile) {
      userObj.perfilAcesso = normalizedProfile;
    } else {
      delete userObj.perfilAcesso;
    }
  }

  if (role) {
    userObj.role = role === 'admin' ? 'admin' : 'user';
  }

  if (senha !== undefined) {
    if (senha && senha.trim()) {
      userObj.senha = senha.trim();
    } else if (userObj.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Administradores devem ter uma senha configurada.'
      });
    } else {
      delete userObj.senha;
    }
  }

  saveMasterDatabase(db);

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso!',
    users: db.hub_users.map(formatHubUserSummary)
  });
});

app.delete('/api/users/:userKey', (req, res) => {
  const db = getMasterDatabase();
  if (!hasAdminPermission(req, db)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem excluir usuários.'
    });
  }

  const { userKey } = req.params;
  if (userKey === 'patrick-monteiro' || userKey === 'felipe-ramos' || userKey === 'william-pessoa') {
    return res.status(400).json({
      success: false,
      message: 'Os administradores mestres (Patrick Monteiro, Felipe Ramos e William Pessoa) não podem ser excluídos.'
    });
  }

  const beforeLen = db.hub_users.length;
  db.hub_users = db.hub_users.filter((u) => u.key !== userKey);
  if (db.hub_users.length === beforeLen) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  saveMasterDatabase(db);

  res.json({
    success: true,
    message: 'Usuário excluído com sucesso.',
    users: db.hub_users.map(formatHubUserSummary)
  });
});

// ==========================================
// ROTA HELPER PARA ABERTURA DE LINKS LOCAIS DE REDE (file:///)
// ==========================================
app.get('/api/open-local', (req, res) => {
  const rawUrl = (req.query.url as string) || (req.query.path as string) || '';
  const title = (req.query.title as string) || 'Ferramenta de Rede Local';

  if (!rawUrl) {
    return res.status(400).send('Caminho ou URL de arquivo não informado.');
  }

  // Decodifica a URL e formata o caminho Windows amigável
  let decodedUrl = decodeURIComponent(rawUrl);
  
  // Trata protocolo file:///
  // Exemplo: file:///z:/ENGENHARIA... -> Z:\ENGENHARIA...
  let windowsPath = decodedUrl
    .replace(/^file:\/\/\/?/i, '')
    .replace(/\//g, '\\');

  // Ajusta letra de unidade se começar com 'z:\' minúsculo
  if (/^[a-z]:\\/i.test(windowsPath)) {
    windowsPath = windowsPath.charAt(0).toUpperCase() + windowsPath.slice(1);
  }

  // Gera o launcher HTML com auto-copy e botões
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Abertura de Rede GIMI</title>
  <style>
    :root {
      --bg: #121212;
      --card-bg: #1e1e1e;
      --border: #333333;
      --green: #27ae60;
      --green-hover: #219653;
      --text: #e0e0e0;
      --muted: #888888;
      --accent: #3498db;
    }
    * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .launcher-card {
      background-color: var(--card-bg);
      border: 2px solid var(--border);
      border-radius: 14px;
      max-width: 680px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 12px 35px rgba(0,0,0,0.5);
      text-align: center;
      animation: popIn 0.3s ease-out;
    }
    @keyframes popIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .badge-tag {
      display: inline-block;
      background: rgba(39, 174, 96, 0.15);
      color: var(--green);
      border: 1px solid var(--green);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 20px;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
      color: #ffffff;
    }
    p.desc {
      font-size: 13.5px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .path-container {
      background: #141414;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 20px;
      text-align: left;
      position: relative;
    }
    .path-label {
      font-size: 10.5px;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: bold;
      margin-bottom: 6px;
      display: block;
    }
    .path-text {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12.5px;
      color: #00ff88;
      word-break: break-all;
      user-select: all;
    }
    .toast-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(39, 174, 96, 0.2);
      border: 1px solid var(--green);
      color: #2ecc71;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 22px;
      transition: all 0.3s ease;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 13px 20px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
    }
    .btn-copy {
      background-color: var(--green);
      color: #ffffff;
    }
    .btn-copy:hover {
      background-color: var(--green-hover);
      transform: translateY(-1px);
    }
    .btn-direct {
      background-color: #2d2d2d;
      color: #ffffff;
      border: 1px solid #555;
    }
    .btn-direct:hover {
      background-color: #383838;
      border-color: #777;
    }
    .instructions-box {
      background-color: rgba(255,255,255,0.03);
      border-left: 4px solid var(--accent);
      border-radius: 6px;
      padding: 16px;
      text-align: left;
      font-size: 12.5px;
      line-height: 1.6;
    }
    .instructions-box b {
      color: #ffffff;
    }
    .instructions-box ol {
      margin-left: 20px;
      margin-top: 6px;
    }
    .instructions-box li {
      margin-bottom: 4px;
    }
    kbd {
      background: #333;
      border: 1px solid #555;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      color: #fffa65;
    }
    .footer-note {
      margin-top: 20px;
      font-size: 11.5px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="launcher-card">
    <div class="badge-tag">📁 Arquivo de Rede Interna GIMI</div>
    <h1>${title}</h1>
    <p class="desc">Devido às políticas de segurança dos navegadores para páginas web, arquivos locais e mapeamentos de rede (unidade Z:) possuem atalhos otimizados.</p>

    <div class="path-container">
      <span class="path-label">Caminho do Arquivo na Rede:</span>
      <div class="path-text" id="windowsPath">${windowsPath}</div>
    </div>

    <div class="toast-status" id="toastStatus">
      <span>✅ Caminho copiado automaticamente para a Área de Transferência!</span>
    </div>

    <div class="actions">
      <button class="btn btn-copy" id="btnManualCopy">
        📋 Copiar Caminho Windows Novamente
      </button>
      <a href="${rawUrl}" class="btn btn-direct" id="btnDirect" target="_blank" rel="noopener noreferrer">
        🚀 Tentar Abertura Direta no Navegador ↗
      </a>
    </div>

    <div class="instructions-box">
      <b>⚡ Como abrir na sua máquina em 2 segundos:</b>
      <ol>
        <li>Pressione as teclas <kbd>Win</kbd> + <kbd>R</kbd> no seu teclado para abrir o menu <b>Executar</b>.</li>
        <li>Pressione <kbd>Ctrl</kbd> + <kbd>V</kbd> (o endereço já está copiado!) e dê <kbd>Enter</kbd>.</li>
        <li>O arquivo/aplicativo abrirá diretamente na sua tela! Ou se preferir, cole na barra de endereços do <b>Microsoft Edge</b> ou <b>Windows Explorer</b>.</li>
      </ol>
    </div>

    <div class="footer-note">
      GIMI Engenharia Elétrica | Atumalaca Automação
    </div>
  </div>

  <script>
    const pathText = "${windowsPath.replace(/\\/g, '\\\\')}";
    const rawFileUrl = "${rawUrl}";

    function copyToClipboard() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pathText).then(() => {
          const toast = document.getElementById('toastStatus');
          toast.style.display = 'inline-flex';
          toast.innerHTML = '<span>✅ Caminho copiado para a Área de Transferência!</span>';
        }).catch(() => {});
      }
    }

    // Auto-copia ao carregar a página
    window.addEventListener('DOMContentLoaded', () => {
      copyToClipboard();
      // Tenta abrir diretamente caso o navegador permita
      try {
        const link = document.createElement('a');
        link.href = rawFileUrl;
        link.target = '_blank';
      } catch (e) {}
    });

    document.getElementById('btnManualCopy').addEventListener('click', () => {
      copyToClipboard();
      const btn = document.getElementById('btnManualCopy');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Copiado com Sucesso!';
      btn.style.backgroundColor = '#2ecc71';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.backgroundColor = '';
      }, 2000);
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 7. Salvar Favoritos individuais do usuário
app.post('/api/users/:userKey/favorites', (req, res) => {
  const { userKey } = req.params;
  const { favoritos } = req.body;

  if (!Array.isArray(favoritos)) {
    return res.status(400).json({ success: false, message: 'Favoritos deve ser uma lista.' });
  }

  const db = getMasterDatabase();
  const userObj = findHubUser(db, userKey);
  if (!userObj) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  userObj.favoritos = favoritos.map(String);
  saveMasterDatabase(db);

  res.json({ success: true, favoritos: userObj.favoritos });
});

// ==========================================
// INSPEÇÃO DO BANCO MESTRE (/api/master-db)
// ==========================================
app.get('/api/master-db', (_req, res) => {
  const db = getMasterDatabase();
  res.json({
    success: true,
    meta: db.meta,
    deleted_ids: db.deleted_ids,
    summary: {
      hub_users: db.hub_users.length,
      hub_tools: db.hub_tools.length,
      hub_permissions: Object.keys(db.hub_permissions || {}).length,
      banco_componentes: db.banco_componentes.length,
      banco_quadros_custom: db.banco_quadros_custom.length,
      banco_armarios_custom: db.banco_armarios_custom.length,
      banco_almofadas_custom: db.banco_almofadas_custom.length,
      projetos_mecanica_salvos: Object.keys(db.projetos_mecanica?.projetos || {}).length,
      projetos_mecanica_rascunho: Boolean(db.projetos_mecanica?.activeDraft),
      projetos_conexoes_salvos: Object.keys(db.projetos_conexoes?.projetos || {}).length,
      projetos_conexoes_rascunho: Boolean(db.projetos_conexoes?.activeDraft),
      eletrica_capacitores: db.eletrica.capacitores.length,
      eletrica_cascateamento: db.eletrica.cascateamento.length,
      r026_historico: db.r026.historico.length
    }
  });
});

// ==========================================
// PERSISTÊNCIA CENTRALIZADA DE PROJETOS (/api/projetos/mecanica & /api/projetos/conexoes)
// ==========================================
function buildProjectId(rawId: unknown, nome: string): string {
  const explicit = String(rawId || '').trim();
  if (explicit) return explicit;
  const slug = String(nome || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${slug || 'proj'}_${Date.now()}`;
}

function handleGetProjetos(storeKey: 'projetos_mecanica' | 'projetos_conexoes') {
  return (req: express.Request, res: express.Response) => {
    const db = getMasterDatabase();
    const store = db[storeKey] || { activeDraft: null, projetos: {} };
    const idParam = String(req.query?.id || '').trim();

    if (idParam) {
      const found = store.projetos[idParam];
      if (!found) {
        return res.status(404).json({ success: false, message: 'Projeto não encontrado no Banco Mestre.' });
      }
      return res.json({ success: true, projeto: found });
    }

    const lista = Object.values(store.projetos || {}).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );

    return res.json({
      success: true,
      activeDraft: store.activeDraft || null,
      projetos: lista
    });
  };
}

function handlePostProjetos(storeKey: 'projetos_mecanica' | 'projetos_conexoes') {
  return (req: express.Request, res: express.Response) => {
    const body = parseRequestBody(req);
    const db = getMasterDatabase();
    if (!db[storeKey]) {
      db[storeKey] = { activeDraft: null, projetos: {} };
    }
    const store = db[storeKey];

    if (body.clearDraft === true) {
      store.activeDraft = null;
      saveMasterDatabase(db);
      return res.json({
        success: true,
        activeDraft: null,
        projetos: Object.values(store.projetos)
      });
    }

    let savedProjeto: any = null;

    if (body.nome && body.data && typeof body.data === 'object') {
      const nomeLimpo = String(body.nome).trim();
      const projId = buildProjectId(body.id, nomeLimpo);
      savedProjeto = {
        id: projId,
        nome: nomeLimpo,
        updatedAt: new Date().toISOString(),
        data: body.data
      };
      store.projetos[projId] = savedProjeto;
    }

    if (body.activeDraft !== undefined) {
      store.activeDraft = body.activeDraft && typeof body.activeDraft === 'object'
        ? { ...body.activeDraft, updatedAt: new Date().toISOString() }
        : null;
    } else if (body.isDraft === true && body.data && typeof body.data === 'object') {
      store.activeDraft = { ...body.data, updatedAt: new Date().toISOString() };
    } else if (!body.nome && body.data && typeof body.data === 'object') {
      store.activeDraft = { ...body.data, updatedAt: new Date().toISOString() };
    }

    saveMasterDatabase(db);
    const lista = Object.values(store.projetos).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );

    return res.json({
      success: true,
      projeto: savedProjeto,
      activeDraft: store.activeDraft,
      projetos: lista
    });
  };
}

function handleDeleteProjetos(storeKey: 'projetos_mecanica' | 'projetos_conexoes') {
  return (req: express.Request, res: express.Response) => {
    const targetId = String(req.params.id || '').trim();
    const db = getMasterDatabase();
    const store = db[storeKey];
    if (!store || !store.projetos || !store.projetos[targetId]) {
      return res.status(404).json({ success: false, message: 'Projeto não encontrado para exclusão.' });
    }

    delete store.projetos[targetId];
    saveMasterDatabase(db);
    const lista = Object.values(store.projetos).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );

    return res.json({
      success: true,
      removedId: targetId,
      projetos: lista
    });
  };
}

app.get('/api/projetos/mecanica', handleGetProjetos('projetos_mecanica'));
app.post('/api/projetos/mecanica', handlePostProjetos('projetos_mecanica'));
app.delete('/api/projetos/mecanica/:id', handleDeleteProjetos('projetos_mecanica'));

app.get('/api/projetos/conexoes', handleGetProjetos('projetos_conexoes'));
app.post('/api/projetos/conexoes', handlePostProjetos('projetos_conexoes'));
app.delete('/api/projetos/conexoes/:id', handleDeleteProjetos('projetos_conexoes'));

// ==========================================
// BANCO DE DADOS CENTRALIZADO DE PESOS E COMPONENTES (/api/pesos/*)
// ==========================================

function buildPesosResponse(db: MasterDatabase) {
  const deletedSet = new Set(db.deleted_ids);
  const quadrosVisiveis = db.banco_quadros_custom.filter((q: any) => q && !deletedSet.has(String(q.id)));

  return {
    componentes: db.banco_componentes.filter((c: any) => c && !deletedSet.has(String(c.id))),
    quadros: {
      SOBREPOR: quadrosVisiveis.filter((q: any) => String(q.tipo || 'SOBREPOR').toUpperCase() === 'SOBREPOR'),
      EMBUTIR: quadrosVisiveis.filter((q: any) => String(q.tipo || '').toUpperCase() === 'EMBUTIR')
    },
    armario: db.banco_armarios_custom.filter((a: any) => a && !deletedSet.has(String(a.id))),
    almofadas_laterais: db.banco_almofadas_custom.filter((a: any) => a && !deletedSet.has(String(a.id))),
    cubiculotraf: (db.pesos_outros.cubiculotraf || []).filter((i: any) => i && !deletedSet.has(String(i.id))),
    cabinebarramento: (db.pesos_outros.cabinebarramento || []).filter((i: any) => i && !deletedSet.has(String(i.id))),
    simplificada: (db.pesos_outros.simplificada || []).filter((i: any) => i && !deletedSet.has(String(i.id))),
    chapas: (db.pesos_outros.chapas || []).filter((i: any) => i && !deletedSet.has(String(i.id))),
    deleted_ids: [...db.deleted_ids]
  };
}

// 1. Retorna todos os catálogos atualizados para alimentar os selects da calculadora em rede
app.get('/api/pesos/itens', (_req, res) => {
  const db = getMasterDatabase();
  res.json({ success: true, data: buildPesosResponse(db) });
});

// 2. Grava permanentemente um novo componente ou estrutura no Banco Mestre (gimi_master_db.json)
app.post('/api/pesos/cadastrar', (req, res) => {
  const { categoria, nome, peso, h, w, d, ch_default, codigo, forma, cor } = req.body || {};

  if (!categoria || !nome || typeof nome !== 'string' || !nome.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Categoria e nome comercial do item são obrigatórios.'
    });
  }

  const db = getMasterDatabase();
  const cleanNome = nome.trim();
  const id = `gimi_${categoria}_${Date.now()}`;
  let novoItem: any = null;

  if (categoria === 'componentes') {
    const numPeso = Number(peso);
    const numPerdaW = Number(req.body?.perdaW);
    if (!Number.isFinite(numPeso) || numPeso <= 0) {
      return res.status(400).json({
        success: false,
        message: 'O peso nominal do equipamento deve ser maior que zero.'
      });
    }
    novoItem = {
      id,
      nome: cleanNome,
      peso: Number(numPeso.toFixed(3)),
      ...(Number.isFinite(numPerdaW) && numPerdaW >= 0 ? { perdaW: Number(numPerdaW.toFixed(1)) } : {})
    };
    db.banco_componentes.push(novoItem);
    db.banco_componentes.sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } else if (categoria === 'chapas') {
    const espessura = Number(peso || req.body?.espessura || 1.5);
    novoItem = { id, nome: cleanNome, espessura };
    db.pesos_outros.chapas.push(novoItem);
  } else {
    const numH = Number(h);
    const numW = Number(w);
    const numD = Number(d);
    const numCh = Number(ch_default) || 14;
    const isAlmofada = categoria === 'almofadas_laterais';

    if (!Number.isFinite(numH) || numH <= 0 || !Number.isFinite(numW) || numW <= 0 || (!isAlmofada && (!Number.isFinite(numD) || numD <= 0))) {
      return res.status(400).json({
        success: false,
        message: isAlmofada
          ? 'Para Almofadas Laterais, informe Altura (H) e Largura (W) maiores que zero.'
          : 'As dimensões Altura (H), Largura (W) e Profundidade (D) devem ser maiores que zero.'
      });
    }

    novoItem = {
      id,
      nome: cleanNome,
      h: numH,
      w: numW,
      d: Number.isFinite(numD) && numD > 0 ? numD : numW,
      ch_default: numCh,
      ...(typeof codigo === 'string' && codigo.trim() ? { codigo: codigo.trim().toUpperCase() } : {}),
      ...(typeof forma === 'string' && forma.trim() ? { forma: forma.trim().toUpperCase() } : {}),
      ...(typeof cor === 'string' && cor.trim() ? { cor: cor.trim().toUpperCase() } : {})
    };

    if (categoria === 'quadros_sobrepor') {
      novoItem.tipo = 'SOBREPOR';
      db.banco_quadros_custom.push(novoItem);
      db.banco_quadros_custom.sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } else if (categoria === 'quadros_embutir') {
      novoItem.tipo = 'EMBUTIR';
      db.banco_quadros_custom.push(novoItem);
      db.banco_quadros_custom.sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } else if (categoria === 'armario') {
      db.banco_armarios_custom.push(novoItem);
      db.banco_armarios_custom.sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } else if (categoria === 'almofadas_laterais') {
      db.banco_almofadas_custom.push(novoItem);
      db.banco_almofadas_custom.sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } else if (categoria === 'cubiculotraf' || categoria === 'cabinebarramento' || categoria === 'simplificada') {
      db.pesos_outros[categoria].push(novoItem);
      db.pesos_outros[categoria].sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    } else {
      return res.status(400).json({
        success: false,
        message: `Categoria de banco inválida: ${categoria}`
      });
    }
  }

  db.deleted_ids = db.deleted_ids.filter((d) => d !== novoItem.id);
  saveMasterDatabase(db);
  res.json({ success: true, item: novoItem, data: buildPesosResponse(db) });
});

// 3. Expurga permanentemente um item selecionado do Banco Mestre e grava em deleted_ids
app.delete('/api/pesos/expurgar', (req, res) => {
  const categoria = String(req.body?.categoria || req.query?.categoria || '').trim();
  const rawId = String(req.body?.id || req.query?.id || '').trim();
  const id = rawId.startsWith('srv_') ? rawId.slice(4) : rawId;

  if (!categoria || !id) {
    return res.status(400).json({
      success: false,
      message: 'Informe a categoria e o ID do item a ser expurgado.'
    });
  }

  const db = getMasterDatabase();
  let beforeCount = 0;
  let afterCount = 0;

  if (categoria === 'componentes') {
    beforeCount = db.banco_componentes.length;
    db.banco_componentes = db.banco_componentes.filter((item: any) => item.id !== id);
    afterCount = db.banco_componentes.length;
  } else if (categoria === 'quadros_sobrepor' || categoria === 'quadros_embutir') {
    beforeCount = db.banco_quadros_custom.length;
    db.banco_quadros_custom = db.banco_quadros_custom.filter((item: any) => item.id !== id);
    afterCount = db.banco_quadros_custom.length;
  } else if (categoria === 'armario') {
    beforeCount = db.banco_armarios_custom.length;
    db.banco_armarios_custom = db.banco_armarios_custom.filter((item: any) => item.id !== id);
    afterCount = db.banco_armarios_custom.length;
  } else if (categoria === 'almofadas_laterais') {
    beforeCount = db.banco_almofadas_custom.length;
    db.banco_almofadas_custom = db.banco_almofadas_custom.filter((item: any) => item.id !== id);
    afterCount = db.banco_almofadas_custom.length;
  } else if (categoria === 'cubiculotraf' || categoria === 'cabinebarramento' || categoria === 'simplificada' || categoria === 'chapas') {
    beforeCount = db.pesos_outros[categoria].length;
    db.pesos_outros[categoria] = db.pesos_outros[categoria].filter((item: any) => item.id !== id);
    afterCount = db.pesos_outros[categoria].length;
  } else {
    return res.status(400).json({
      success: false,
      message: `Categoria inválida para expurgo: ${categoria}`
    });
  }

  const isPresetSuppress = categoria === 'componentes' && beforeCount === afterCount && (rawId.length > 0);
  if (beforeCount === afterCount && !isPresetSuppress) {
    return res.status(404).json({
      success: false,
      message: 'Item não localizado no banco central do servidor.'
    });
  }

  if (!db.deleted_ids.includes(id)) {
    db.deleted_ids.push(id);
  }
  if (rawId !== id && !db.deleted_ids.includes(rawId)) {
    db.deleted_ids.push(rawId);
  }

  saveMasterDatabase(db);
  res.json({ success: true, removedId: id, data: buildPesosResponse(db) });
});

// ==========================================
// BANCO DE DADOS CENTRALIZADO DE ELÉTRICA & PROTEÇÃO (/api/eletrica/*)
// ==========================================

function buildEletricaResponse(db: MasterDatabase) {
  const deletedSet = new Set(db.deleted_ids);
  return {
    capacitores: (db.eletrica.capacitores || []).filter((c: any) => c && !deletedSet.has(String(c.id))),
    dimensionamentos: db.eletrica.dimensionamentos || [],
    cascateamento: (db.eletrica.cascateamento || []).filter((c: any) => c && !deletedSet.has(String(c.id))),
    deleted_ids: [...db.deleted_ids]
  };
}

// 1. Retorna todos os dados técnicos centralizados de capacitores, dimensionamentos e cascateamento
app.get('/api/eletrica/dados', (_req, res) => {
  const db = getMasterDatabase();
  res.json({
    success: true,
    data: buildEletricaResponse(db)
  });
});

// 2. Grava permanentemente novos capacitores, parâmetros de dimensionamento ou pares de cascateamento no Banco Mestre
app.post('/api/eletrica/cadastrar', (req, res) => {
  const tipo = String(req.body?.tipo || req.body?.categoria || '').trim().toLowerCase();
  const db = getMasterDatabase();

  if (tipo === 'capacitor' || tipo === 'capacitores') {
    const marca = String(req.body?.marca || 'WEG').trim().toUpperCase();
    const code = String(req.body?.code || req.body?.codigo || '').trim();
    const desc = String(req.body?.desc || req.body?.descricao || '').trim();
    const kvar = Number(req.body?.kvar);
    const voltage = Number(req.body?.voltage || req.body?.tensao);

    if (!code || !desc || !Number.isFinite(kvar) || kvar <= 0 || !Number.isFinite(voltage) || voltage <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Preencha código, descrição, potência reativa (kVAr > 0) e tensão nominal válida.'
      });
    }

    const novoCap = {
      id: `cap_srv_${Date.now()}`,
      code,
      desc,
      marca,
      kvar: Number(kvar.toFixed(2)),
      voltage: Math.round(voltage)
    };

    db.eletrica.capacitores.push(novoCap);
    db.eletrica.capacitores.sort((a: any, b: any) => a.kvar - b.kvar || a.voltage - b.voltage);
    db.deleted_ids = db.deleted_ids.filter((d) => d !== novoCap.id);
    saveMasterDatabase(db);

    return res.json({
      success: true,
      item: novoCap,
      data: buildEletricaResponse(db)
    });
  }

  if (tipo === 'cascateamento' || tipo === 'disjuntor') {
    const fabricante = String(req.body?.fabricante || 'WEG').trim().toUpperCase();
    const tensao = String(req.body?.tensao || '').trim();
    const montante = String(req.body?.montante || '').trim();
    const jusante = String(req.body?.jusante || '').trim();
    const icc = String(req.body?.icc || '').trim();
    const obs = String(req.body?.obs || 'Associação técnica cadastrada pela Engenharia GIMI.').trim();

    if (!fabricante || !tensao || !montante || !jusante || !icc) {
      return res.status(400).json({
        success: false,
        message: 'Informe fabricante, tensão de ensaio, disjuntor a montante (C2), disjuntor a jusante (C1) e Icc combinada.'
      });
    }

    const iccFormatted = /ka$/i.test(icc) ? icc : `${icc} kA`;
    const novoCasc = {
      id: `casc_srv_${Date.now()}`,
      fabricante,
      tensao,
      montante,
      jusante,
      icc: iccFormatted,
      obs
    };

    db.eletrica.cascateamento.push(novoCasc);
    db.deleted_ids = db.deleted_ids.filter((d) => d !== novoCasc.id);
    saveMasterDatabase(db);

    return res.json({
      success: true,
      item: novoCasc,
      data: buildEletricaResponse(db)
    });
  }

  if (tipo === 'dimensionamento' || tipo === 'contator') {
    const kvar = Number(req.body?.kvar);
    const tensaoRef = String(req.body?.tensaoKey || 'v380');
    const corrente = Number(req.body?.i || req.body?.corrente);
    const cabo = String(req.body?.cabo || '').trim();
    const fusivel = Number(req.body?.fusivel);
    const chave = Number(req.body?.chave);

    if (!Number.isFinite(kvar) || kvar <= 0 || !cabo || !Number.isFinite(fusivel) || fusivel <= 0 || !Number.isFinite(chave) || chave <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Informe potência (kVAr), cabo (mm²), fusível (A) e contator/chave (A) válidos.'
      });
    }

    const validKey = ['v220', 'v380', 'v440', 'v480'].includes(tensaoRef) ? tensaoRef : 'v380';
    const vNum = Number(validKey.replace('v', '')) || 380;
    const calcAmps = Number.isFinite(corrente) && corrente > 0
      ? Number(corrente.toFixed(1))
      : Number(((kvar * 1000) / (Math.sqrt(3) * vNum)).toFixed(1));

    let row = db.eletrica.dimensionamentos.find((r: any) => Math.abs(Number(r.kvar) - kvar) < 0.05);
    if (!row) {
      row = {
        kvar: Number(kvar.toFixed(1)),
        v220: { i: Number(((kvar * 1000) / (Math.sqrt(3) * 220)).toFixed(1)), cabo, fusivel, chave },
        v380: { i: Number(((kvar * 1000) / (Math.sqrt(3) * 380)).toFixed(1)), cabo, fusivel, chave },
        v440: { i: Number(((kvar * 1000) / (Math.sqrt(3) * 440)).toFixed(1)), cabo, fusivel, chave },
        v480: { i: Number(((kvar * 1000) / (Math.sqrt(3) * 480)).toFixed(1)), cabo, fusivel, chave }
      };
      row[validKey] = { i: calcAmps, cabo, fusivel, chave };
      db.eletrica.dimensionamentos.push(row);
      db.eletrica.dimensionamentos.sort((a: any, b: any) => a.kvar - b.kvar);
    } else {
      row[validKey] = { i: calcAmps, cabo, fusivel, chave };
    }

    saveMasterDatabase(db);
    return res.json({
      success: true,
      item: row,
      data: buildEletricaResponse(db)
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Tipo de cadastro inválido. Utilize "capacitor", "cascateamento" ou "dimensionamento".'
  });
});

// 3. Expurga permanentemente um capacitor ou par de cascateamento do Banco Mestre e registra em deleted_ids
app.delete('/api/eletrica/expurgar', (req, res) => {
  const tipo = String(req.body?.tipo || req.query?.tipo || '').trim().toLowerCase();
  const id = String(req.body?.id || req.query?.id || '').trim();

  if (!tipo || !id) {
    return res.status(400).json({
      success: false,
      message: 'Informe o tipo ("capacitor" ou "cascateamento") e o ID do registro para expurgo.'
    });
  }

  const db = getMasterDatabase();

  if (tipo === 'capacitor' || tipo === 'capacitores') {
    const before = db.eletrica.capacitores.length;
    db.eletrica.capacitores = db.eletrica.capacitores.filter((c: any) => c.id !== id);
    if (db.eletrica.capacitores.length === before) {
      return res.status(404).json({ success: false, message: 'Capacitor não localizado no servidor.' });
    }
    if (!db.deleted_ids.includes(id)) db.deleted_ids.push(id);
    saveMasterDatabase(db);
    return res.json({
      success: true,
      removedId: id,
      data: buildEletricaResponse(db)
    });
  }

  if (tipo === 'cascateamento' || tipo === 'disjuntor') {
    const before = db.eletrica.cascateamento.length;
    db.eletrica.cascateamento = db.eletrica.cascateamento.filter((c: any) => c.id !== id);
    if (db.eletrica.cascateamento.length === before) {
      return res.status(404).json({ success: false, message: 'Associação de cascateamento não localizada no servidor.' });
    }
    if (!db.deleted_ids.includes(id)) db.deleted_ids.push(id);
    saveMasterDatabase(db);
    return res.json({
      success: true,
      removedId: id,
      data: buildEletricaResponse(db)
    });
  }

  return res.status(400).json({ success: false, message: 'Tipo inválido para expurgo.' });
});

// ==========================================
// SUÍTE DE CONEXÕES & BARRAMENTOS (/api/conexoes/*)
// ==========================================

app.get('/api/conexoes/dados', (_req, res) => {
  const db = getMasterDatabase();
  res.json({ success: true, data: db.conexoes_base });
});

app.get('/api/conexoes/terminais', (_req, res) => {
  const db = getMasterDatabase();
  res.json({ success: true, terminais: db.conexoes_base.terminais });
});

app.get('/api/conexoes/barramentos', (_req, res) => {
  const db = getMasterDatabase();
  res.json({ success: true, barramentos: db.conexoes_base.barramentos_nominais });
});

app.get('/api/conexoes/tubos', (_req, res) => {
  const db = getMasterDatabase();
  res.json({ success: true, tubos: db.conexoes_base.tubos_termocontrateis_tabela });
});

app.post('/api/conexoes/salvar', (req, res) => {
  const payload = parseRequestBody(req);
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, message: 'Payload inválido.' });
  }
  const db = getMasterDatabase();
  db.conexoes_base = {
    ...db.conexoes_base,
    ...payload
  };
  saveMasterDatabase(db);
  res.json({ success: true, data: db.conexoes_base });
});

// ==========================================
// CONFIGURADOR DE ARMÁRIO GIMI (Rascunho Ativo em gimi_master_db.json)
// ==========================================

function mergeArmarioWithDefaults(parsed: any): typeof DEFAULT_ARMARIO_CONFIG {
  if (!parsed || typeof parsed !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_ARMARIO_CONFIG));
  }
  return {
    ...DEFAULT_ARMARIO_CONFIG,
    ...parsed,
    djg1: { ...DEFAULT_ARMARIO_CONFIG.djg1, ...(parsed.djg1 || {}) },
    djg2: { ...DEFAULT_ARMARIO_CONFIG.djg2, ...(parsed.djg2 || {}) },
    bg: { ...DEFAULT_ARMARIO_CONFIG.bg, ...(parsed.bg || {}) },
    bn: { ...DEFAULT_ARMARIO_CONFIG.bn, ...(parsed.bn || {}) },
    bt: { ...DEFAULT_ARMARIO_CONFIG.bt, ...(parsed.bt || {}) },
    disjuntoresBarras: Array.isArray(parsed.disjuntoresBarras) ? parsed.disjuntoresBarras : [],
    disjuntoresCabos: Array.isArray(parsed.disjuntoresCabos) ? parsed.disjuntoresCabos : []
  };
}

app.get('/api/conexoes/armario', (_req, res) => {
  const db = getMasterDatabase();
  const config = mergeArmarioWithDefaults(db.projetos_conexoes?.activeDraft);
  res.json({ success: true, config });
});

app.post('/api/conexoes/armario', (req, res) => {
  const payload = parseRequestBody(req);
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, message: 'Dados de armário inválidos.' });
  }

  const db = getMasterDatabase();
  if (!db.projetos_conexoes) {
    db.projetos_conexoes = { activeDraft: null, projetos: {} };
  }
  const current = mergeArmarioWithDefaults(db.projetos_conexoes.activeDraft);
  const merged = {
    ...current,
    ...payload,
    atualizadoEm: new Date().toISOString()
  };

  db.projetos_conexoes.activeDraft = merged;
  saveMasterDatabase(db);
  res.json({
    success: true,
    message: 'Configuração do Armário salva com sucesso em data/gimi_master_db.json!',
    config: merged
  });
});

app.post('/api/conexoes/armario/reset', (_req, res) => {
  const db = getMasterDatabase();
  if (!db.projetos_conexoes) {
    db.projetos_conexoes = { activeDraft: null, projetos: {} };
  }
  db.projetos_conexoes.activeDraft = null;
  saveMasterDatabase(db);
  res.json({
    success: true,
    message: 'Configuração padrão do armário restaurada com sucesso!',
    config: JSON.parse(JSON.stringify(DEFAULT_ARMARIO_CONFIG))
  });
});

// ==========================================
// CENTRAL R026 - LIBERAÇÃO DE PROJETOS & DISPARO DE E-MAILS (/api/r026/*)
// ==========================================

const R026_TEST_RECIPIENTS = ['projetoeletrico14@gimi.com.br'];

const DEFAULT_R026_PROJETISTAS = [
  { id: 'p1', nome: 'WILLIAN PESSOA', email: 'projetoeletrico1@gimi.com.br' },
  { id: 'p2', nome: 'KELVIN MARQUES', email: 'projetoeletrico2@gimi.com.br' },
  { id: 'p3', nome: 'WALTHER MENEZES', email: 'projetoeletrico3@gimi.com.br' },
  { id: 'p4', nome: 'THAYLA NITHELY', email: 'projetoeletrico4@gimi.com.br' },
  { id: 'p5', nome: 'PATRICK SANTOS', email: 'projetoeletrico5@gimi.com.br' },
  { id: 'p6', nome: 'MATEUS RIBEIRO', email: 'projetoeletrico6@gimi.com.br' },
  { id: 'p7', nome: 'FELIPE RAMOS', email: 'projetoeletrico7@gimi.com.br' },
  { id: 'p8', nome: 'GERALDO SANTOS', email: 'projetoeletrico8@gimi.com.br' },
  { id: 'p9', nome: 'CLAUDINEI FERREIRA', email: 'projetoeletrico9@gimi.com.br' },
  { id: 'p10', nome: 'GUSTAVO AUGUSTO', email: 'projetoeletrico10@gimi.com.br' },
  { id: 'p11', nome: 'BRUNO FERREIRA LIMA', email: 'projetoeletrico11@gimi.com.br' },
  { id: 'p12', nome: 'WEBER FERNANDES', email: 'projetoeletrico12@gimi.com.br' },
  { id: 'p13', nome: 'RODRIGO RIBEIRO', email: 'projetoeletrico13@gimi.com.br' },
  { id: 'p14', nome: 'PATRICK MONTEIRO', email: 'projetoeletrico14@gimi.com.br' },
  { id: 'p15', nome: 'SEBASTIÃO XIMENES', email: 'projetoeletrico15@gimi.com.br' },
  { id: 'p16', nome: 'BRUNO SILVA', email: 'projetoeletrico16@gimi.com.br' },
  { id: 'p17', nome: 'CLAUDIO BRANDÃO', email: 'projetoeletrico17@gimi.com.br' },
  { id: 'p18', nome: 'LUCAS LOPES', email: 'projetoeletrico18@gimi.com.br' },
  { id: 'p19', nome: 'MAILSON GOMES', email: 'projetoeletrico19@gimi.com.br' }
].sort((a, b) => a.nome.localeCompare(b.nome));

const DEFAULT_R026_EMAILS: Record<string, { destinatarios: string[]; interessados: string[] }> = {
  MECANICO: {
    destinatarios: [
      'projetomecanico1@gimi.com.br',
      'projetomecanico2@gimi.com.br',
      'projetomecanico3@gimi.com.br',
      'projetomecanico4@gimi.com.br',
      'projetomecanico5@gimi.com.br',
      'projetomecanico6@gimi.com.br',
      'projetomecanico7@gimi.com.br',
      'projetomecanico8@gimi.com.br',
      'projetomecanico9@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br'
    ]
  },
  FABRICA: {
    destinatarios: [
      'me1@gimi.com.br',
      'm2@gimi.com.br',
      'me3@gimi.com.br',
      'mp1@gimi.com.br',
      'pcp1@gimi.com.br',
      'pcp5@gimi.com.br',
      'pcm1@gimi.com.br',
      'recebimento1@gimi.com.br',
      'estoque1@gimi.com.br',
      'funilaria@gimi.com.br',
      'industrial1@gimi.com.br',
      'projetomecanico1@gimi.com.br',
      'projetomecanico2@gimi.com.br',
      'projetomecanico3@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br',
      'contratos1@gimi.com.br',
      'contratos2@gimi.com.br',
      'contratos3@gimi.com.br',
      'contratos4@gimi.com.br',
      'contratos5@gimi.com.br',
      'contratos6@gimi.com.br',
      'contratos2@gimiservice.com.br',
      'almoxarifado1@gimibonomi.com.br',
      'almoxarifado1@grupogimi.com.br'
    ]
  },
  'SUBSTITUIÇÃO': {
    destinatarios: [
      'me1@gimi.com.br',
      'm2@gimi.com.br',
      'me3@gimi.com.br',
      'mp1@gimi.com.br',
      'pcp1@gimi.com.br',
      'pcp5@gimi.com.br',
      'pcm1@gimi.com.br',
      'recebimento1@gimi.com.br',
      'estoque1@gimi.com.br',
      'funilaria@gimi.com.br',
      'industrial1@gimi.com.br',
      'projetomecanico1@gimi.com.br',
      'projetomecanico2@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br',
      'contratos1@gimi.com.br',
      'contratos2@gimi.com.br',
      'contratos3@gimi.com.br',
      'contratos4@gimi.com.br',
      'contratos5@gimi.com.br',
      'contratos6@gimi.com.br'
    ]
  },
  PARALIZADO: {
    destinatarios: [
      'me1@gimi.com.br',
      'm2@gimi.com.br',
      'me3@gimi.com.br',
      'mp1@gimi.com.br',
      'pcp1@gimi.com.br',
      'pcp5@gimi.com.br',
      'pcm1@gimi.com.br',
      'recebimento1@gimi.com.br',
      'estoque1@gimi.com.br',
      'funilaria@gimi.com.br',
      'industrial1@gimi.com.br'
    ],
    interessados: [
      'eng1@engenhadev.com',
      'projetoeletrico1@gimi.com.br',
      'projetoeletrico7@gimi.com.br',
      'contratos1@gimi.com.br',
      'contratos2@gimi.com.br'
    ]
  }
};

const DEFAULT_R026_HISTORICO = [
  { id: 1, data: '2026-09-15', projetista: 'PATRICK MONTEIRO', processo: 'F-1908', itens: '40,48,55,68,78', rev: '01,02', tipo: 'FABRICA', obs: 'FABRICAÇÃO LIBERADA COM SUCESSO', emailStatus: 'E-mail Enviado' },
  { id: 2, data: '2026-09-14', projetista: 'PATRICK MONTEIRO', processo: 'F-1908', itens: '05,12,15,16,17', rev: '01,02', tipo: 'SUBSTITUIÇÃO', obs: 'Troca dos dimensionais para comportar cabos de entrada do cliente', emailStatus: 'E-mail Enviado' },
  { id: 3, data: '2026-09-11', projetista: 'PATRICK SANTOS', processo: 'F-1976', itens: '1,2', rev: '1', tipo: 'FABRICA', obs: 'ATENÇÃO AO ACOPLAMENTO DO QGBT', emailStatus: 'E-mail Enviado' },
  { id: 4, data: '2026-09-10', projetista: 'BRUNO FERREIRA LIMA', processo: 'F-2201', itens: '1,2,3', rev: '0', tipo: 'MECANICO', obs: 'ITENS 2 E 3 SÃO AS CAIXAS AUMENTADAS DO PROCESSO 16595', emailStatus: 'E-mail Enviado' },
  { id: 5, data: '2026-08-28', projetista: 'BRUNO FERREIRA LIMA', processo: 'F-1714', itens: '1,3,4,5,6,7', rev: '3,2,1', tipo: 'PARALIZADO', obs: 'EM REVISÃO SOLICITADO PELO CLIENTE (HOLD)', emailStatus: 'E-mail Enviado' }
];

function getR026EmailsDatabase() {
  const db = getMasterDatabase();
  const projetistas = Array.isArray(db.r026?.projetistas) ? db.r026.projetistas : [];
  projetistas.sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || '')));
  return {
    emails: db.r026?.emails || JSON.parse(JSON.stringify(DEFAULT_R026_EMAILS_SEED)),
    projetistas
  };
}

function saveR026EmailsDatabase(data: { emails: Record<string, any>; projetistas: any[] }) {
  const db = getMasterDatabase();
  data.projetistas.sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || '')));
  db.r026.emails = data.emails;
  db.r026.projetistas = data.projetistas;
  saveMasterDatabase(db);
}

function lerHistoricoR026Disco(): any[] {
  const db = getMasterDatabase();
  return Array.isArray(db.r026?.historico) ? db.r026.historico : [];
}

function salvarHistoricoR026Disco(historico: any[]): void {
  const db = getMasterDatabase();
  db.r026.historico = Array.isArray(historico) ? historico : [];
  saveMasterDatabase(db);
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const R026_DEFAULT_FROM = 'GIMI Hub <onboarding@resend.dev>';

function getResendSettings() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const isConfigured = Boolean(apiKey);
  const client = isConfigured ? (resend ?? new Resend(apiKey)) : null;

  return { apiKey, from: R026_DEFAULT_FROM, isConfigured, client };
}

// 1. Diagnóstico do Serviço de E-mails da Central R026 (Resend API)
async function handleR026EmailStatus(_req: express.Request, res: express.Response) {
  const cfg = getResendSettings();
  const checkedAt = new Date().toISOString();

  if (!cfg.isConfigured || !cfg.client) {
    return res.json({
      success: true,
      configured: false,
      connected: false,
      mode: 'fila-local',
      provider: 'Resend API (api.resend.com)',
      host: 'api.resend.com',
      from: cfg.from,
      message: 'Servidor Node.js online. Configure RESEND_API_KEY nas variáveis de ambiente para disparo externo via Resend.',
      checkedAt
    });
  }

  try {
    const { error } = await cfg.client.domains.list();
    // Chaves restritas apenas para envio ("restricted_api_key") são válidas e autenticadas para resend.emails.send()
    if (error && error.name !== 'restricted_api_key') {
      return res.json({
        success: true,
        configured: true,
        connected: false,
        mode: 'resend-erro',
        provider: 'Resend API (api.resend.com)',
        host: 'api.resend.com',
        from: cfg.from,
        message: `Falha ao validar RESEND_API_KEY na API Resend: ${error.message || 'Chave inválida ou sem autorização'}.`,
        checkedAt
      });
    }

    return res.json({
      success: true,
      configured: true,
      connected: true,
      mode: 'resend-ativo',
      provider: 'Resend API (api.resend.com)',
      host: 'api.resend.com',
      from: cfg.from,
      message:
        error?.name === 'restricted_api_key'
          ? 'Conectado com sucesso à API Resend (chave autenticada com permissão exclusiva de envio).'
          : 'Conectado com sucesso à API oficial do Resend (api.resend.com).',
      checkedAt
    });
  } catch (err: any) {
    return res.json({
      success: true,
      configured: true,
      connected: false,
      mode: 'resend-erro',
      provider: 'Resend API (api.resend.com)',
      host: 'api.resend.com',
      from: cfg.from,
      message: `Erro ao comunicar com a API Resend: ${err?.message || 'Falha de rede'}.`,
      checkedAt
    });
  }
}

app.get('/api/r026/resend-status', handleR026EmailStatus);

// 2. Obter todos os dados sincronizados da Central R026 (E-mails, Projetistas e Histórico)
app.get('/api/r026/dados', (_req, res) => {
  const { emails, projetistas } = getR026EmailsDatabase();
  const historico = lerHistoricoR026Disco();
  const cfg = getResendSettings();

  res.json({
    success: true,
    data: {
      emails,
      projetistas,
      historico,
      resend: {
        configured: cfg.isConfigured,
        provider: 'Resend API',
        host: 'api.resend.com',
        from: cfg.from
      }
    }
  });
});

// 3. Obter apenas o histórico global de liberações R026 diretamente do disco
app.get('/api/r026/historico', (_req, res) => {
  const historico = lerHistoricoR026Disco();
  res.json({ success: true, historico });
});

// 4. Salvar alterações da tabela de LOGS / Grupos de E-mail no servidor central
app.put('/api/r026/config-emails', (req, res) => {
  const incomingEmails = req.body?.emails;
  if (!incomingEmails || typeof incomingEmails !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Estrutura de grupos de e-mails inválida.'
    });
  }

  const db = getR026EmailsDatabase();
  const sanitized: Record<string, { destinatarios: string[]; interessados: string[] }> = {};

  for (const key of ['MECANICO', 'FABRICA', 'SUBSTITUIÇÃO', 'PARALIZADO']) {
    const group = incomingEmails[key] || db.emails[key] || { destinatarios: [], interessados: [] };
    const dest = Array.isArray(group.destinatarios)
      ? group.destinatarios.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean)
      : [];
    const cc = Array.isArray(group.interessados)
      ? group.interessados.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean)
      : [];
    sanitized[key] = { destinatarios: dest, interessados: cc };
  }

  db.emails = sanitized;
  saveR026EmailsDatabase(db);

  res.json({
    success: true,
    emails: db.emails,
    message: 'Mapeamento de destinatários e cópias salvo globalmente no servidor!'
  });
});

// 5. Cadastrar novo projetista na lista oficial centralizada
app.post('/api/r026/projetistas', (req, res) => {
  const nome = String(req.body?.nome || '').trim().toUpperCase();
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!nome || !email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Informe um nome válido e um e-mail corporativo válido.'
    });
  }

  const db = getR026EmailsDatabase();
  const exists = db.projetistas.some((p: any) => p.nome.toUpperCase() === nome || p.email.toLowerCase() === email);
  if (exists) {
    return res.status(409).json({
      success: false,
      message: 'Já existe um projetista cadastrado com este nome ou e-mail.'
    });
  }

  const novoProjetista = {
    id: `p_${Date.now()}`,
    nome,
    email
  };

  db.projetistas.push(novoProjetista);
  saveR026EmailsDatabase(db);

  res.json({
    success: true,
    projetista: novoProjetista,
    projetistas: db.projetistas
  });
});

// 6. Editar projetista existente na lista oficial centralizada
app.put('/api/r026/projetistas/:id', (req, res) => {
  const { id } = req.params;
  const nome = String(req.body?.nome || '').trim().toUpperCase();
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!nome || !email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Informe um nome válido e um e-mail corporativo válido.'
    });
  }

  const db = getR026EmailsDatabase();
  const idx = db.projetistas.findIndex((p: any) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({
      success: false,
      message: 'Projetista não encontrado no banco central.'
    });
  }

  db.projetistas[idx] = {
    ...db.projetistas[idx],
    nome,
    email
  };
  saveR026EmailsDatabase(db);

  res.json({
    success: true,
    projetista: db.projetistas.find((p: any) => p.id === id),
    projetistas: db.projetistas
  });
});

// 7. Excluir projetista da lista oficial centralizada
app.delete('/api/r026/projetistas/:id', (req, res) => {
  const { id } = req.params;
  const db = getR026EmailsDatabase();
  const before = db.projetistas.length;
  db.projetistas = db.projetistas.filter((p: any) => p.id !== id);

  if (db.projetistas.length === before) {
    return res.status(404).json({
      success: false,
      message: 'Projetista não localizado para exclusão.'
    });
  }

  saveR026EmailsDatabase(db);
  res.json({
    success: true,
    removedId: id,
    projetistas: db.projetistas
  });
});

// Utilitários de formatação e Template HTML Corporativo Premium (Resend - Central R026)
function escapeHtmlR026(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarDataBrR026(isoDate: string): string {
  const limpo = String(isoDate || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpo);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return limpo || '-';
}

function obterMetaTipoR026(tipoRaw: string): { rotulo: string; cor: string } {
  const chave = String(tipoRaw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (chave === 'MECANICO') {
    return { rotulo: 'MECÂNICO', cor: '#1a365d' };
  }
  if (chave === 'FABRICA') {
    return { rotulo: 'FÁBRICA', cor: '#d97706' };
  }
  if (chave === 'SUBSTITUICAO') {
    return { rotulo: 'SUBSTITUIÇÃO', cor: '#059669' };
  }
  if (chave === 'PARALIZADO' || chave === 'PARALISADO') {
    return { rotulo: 'PARALISADO', cor: '#dc2626' };
  }
  return { rotulo: tipoRaw || 'FÁBRICA', cor: '#d97706' };
}

interface DadosTemplateEmailR026 {
  tipo: string;
  processo: string;
  rev: string;
  itens: string;
  projetista: string;
  dataSolicitacao: string;
  obs: string;
  modoTeste?: boolean;
  destinatariosOficiais?: string[];
  interessadosOficiais?: string[];
}

function gerarTemplateEmailR026(dados: DadosTemplateEmailR026): string {
  const { rotulo, cor } = obterMetaTipoR026(dados.tipo);
  const processoSafe = escapeHtmlR026(dados.processo);
  const revSafe = escapeHtmlR026(dados.rev || '0');
  const itensSafe = escapeHtmlR026(dados.itens);
  const projetistaSafe = escapeHtmlR026(dados.projetista);
  const dataFormatada = escapeHtmlR026(formatarDataBrR026(dados.dataSolicitacao));
  const obsSafe = escapeHtmlR026(dados.obs || 'Nenhuma observação técnica adicional informada para esta liberação.').replace(/\r?\n/g, '<br/>');

  const listaParaOficial = Array.isArray(dados.destinatariosOficiais) && dados.destinatariosOficiais.length > 0
    ? escapeHtmlR026(dados.destinatariosOficiais.join(', '))
    : '(Nenhum destinatário cadastrado para esta ação)';

  const listaCcOficial = Array.isArray(dados.interessadosOficiais) && dados.interessadosOficiais.length > 0
    ? escapeHtmlR026(dados.interessadosOficiais.join(', '))
    : '(Nenhum interessado em cópia cadastrado)';

  const faixaModoTeste = dados.modoTeste
    ? `<div style="background-color:#7c3aed;color:#ffffff;padding:9px 24px;font-size:11.5px;font-weight:700;text-align:center;letter-spacing:0.4px;text-transform:uppercase;">
        Ambiente de Teste Ativo &mdash; Nenhum setor produtivo foi acionado
      </div>
      <div style="background-color:#f5f3ff;border-bottom:1px solid #ddd6fe;padding:14px 28px;font-size:12px;line-height:1.55;color:#2e1065;">
        <div style="font-size:11px;font-weight:800;color:#6d28d9;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
          Homologação de Roteamento Oficial &mdash; Quem receberia este e-mail em Produção:
        </div>
        <div style="margin-bottom:6px;">
          <strong style="color:#4c1d95;">Destinatários Oficiais (Para):</strong>
          <span style="color:#1e293b;font-family:'Consolas','Courier New',monospace;font-size:11.5px;word-break:break-word;">${listaParaOficial}</span>
        </div>
        <div>
          <strong style="color:#4c1d95;">Interessados (CC):</strong>
          <span style="color:#334155;font-family:'Consolas','Courier New',monospace;font-size:11.5px;word-break:break-word;">${listaCcOficial}</span>
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Notificação Oficial de Liberação R026 - ${processoSafe}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <div style="background-color:#f1f5f9;padding:24px 14px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,0.06);">
      ${faixaModoTeste}
      <!-- Cabeçalho Corporativo Escuro -->
      <div style="background-color:#1a1a1a;padding:22px 28px;border-bottom:3px solid #22c55e;">
        <div style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;line-height:1.25;">
          GIMI <span style="color:#52525b;font-weight:400;margin:0 4px;">|</span> <span style="color:#22c55e;">Engenharia &amp; Automação</span>
        </div>
        <div style="font-size:12.5px;color:#a1a1aa;margin-top:5px;font-weight:500;">
          Notificação Oficial de Liberação de Projeto (R026)
        </div>
      </div>

      <!-- Conteúdo Principal -->
      <div style="padding:26px 28px;background-color:#ffffff;">
        <!-- Badge de Ação -->
        <div style="margin-bottom:22px;">
          <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:7px;">
            Classificação da Liberação
          </div>
          <span style="display:inline-block;background-color:${cor};color:#ffffff;padding:6px 15px;border-radius:6px;font-size:12.5px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;">
            ${rotulo}
          </span>
        </div>

        <!-- Grid de Informações da Obra -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:22px;">
          <tr>
            <td style="width:55%;padding:13px 16px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;background-color:#ffffff;vertical-align:top;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Processo / Obra</div>
              <div style="font-size:16px;font-weight:800;color:#0f172a;font-family:'Consolas','Courier New',monospace;">${processoSafe}</div>
            </td>
            <td style="width:45%;padding:13px 16px;border-bottom:1px solid #e2e8f0;background-color:#ffffff;vertical-align:top;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Revisão</div>
              <div style="font-size:15px;font-weight:700;color:#1e293b;font-family:'Consolas','Courier New',monospace;">Rev. ${revSafe}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;background-color:#fcfcfd;vertical-align:top;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Itens da Obra</div>
              <div style="font-size:14px;font-weight:700;color:#0f172a;">${itensSafe}</div>
            </td>
          </tr>
          <tr>
            <td style="width:55%;padding:13px 16px;border-right:1px solid #e2e8f0;background-color:#ffffff;vertical-align:top;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Projetista Responsável</div>
              <div style="font-size:13.5px;font-weight:700;color:#1e293b;">${projetistaSafe}</div>
            </td>
            <td style="width:45%;padding:13px 16px;background-color:#ffffff;vertical-align:top;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Data de Solicitação</div>
              <div style="font-size:13.5px;font-weight:700;color:#1e293b;font-family:'Consolas','Courier New',monospace;">${dataFormatada}</div>
            </td>
          </tr>
        </table>

        <!-- Caixa de Observações -->
        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${cor};border-radius:6px;padding:15px 18px;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            Observações Técnicas da Liberação
          </div>
          <div style="font-size:13.5px;line-height:1.55;color:#1e293b;">
            ${obsSafe}
          </div>
        </div>
      </div>

      <!-- Rodapé Corporativo -->
      <div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11.5px;color:#64748b;font-weight:500;">
        Mensagem automática gerada pela Central R026 - Hub GIMI Engenharia
      </div>
    </div>
  </div>
</body>
</html>`;
}

// 8. Disparar Liberação R026 via Resend SDK + Persistência Permanente em Disco (data/historico_r026.json)
app.post('/api/r026/disparar-liberacao', async (req, res) => {
  const dataSolicitacao = String(req.body?.data || new Date().toISOString().split('T')[0]).trim();
  const projetista = String(req.body?.projetista || '').trim().toUpperCase();
  const processo = String(req.body?.processo || '').trim().toUpperCase();
  const rev = String(req.body?.rev ?? '0').trim() || '0';
  const itens = String(req.body?.itens || '').trim();
  const obs = String(req.body?.obs || '').trim();
  const tipo = String(req.body?.tipo || 'FABRICA').trim().toUpperCase();
  const modoTeste = Boolean(req.body?.modoTeste);

  if (!projetista || !processo || !itens) {
    return res.status(400).json({
      success: false,
      message: 'Preencha obrigatoriamente Projetista, Processo/Obra e Itens da Obra antes de disparar.'
    });
  }

  const { emails, projetistas } = getR026EmailsDatabase();
  const { rotulo: rotuloTipo } = obterMetaTipoR026(tipo);

  // Sempre mapeia os destinatários e cópias oficiais da categoria para envio real ou homologação em Modo de Teste
  const grupoOficial = emails[tipo] || emails.FABRICA || { destinatarios: [], interessados: [] };
  const destinatariosOficiaisPara: string[] = Array.isArray(grupoOficial.destinatarios)
    ? [...grupoOficial.destinatarios]
    : [];
  const destinatariosOficiaisCc: string[] = Array.isArray(grupoOficial.interessados)
    ? [...grupoOficial.interessados]
    : [];

  // Inclui em cópia oficial o e-mail corporativo do projetista responsável, se cadastrado
  const cadProj = projetistas.find((p: any) => String(p.nome).toUpperCase() === projetista);
  if (
    cadProj?.email &&
    !destinatariosOficiaisCc.includes(cadProj.email) &&
    !destinatariosOficiaisPara.includes(cadProj.email)
  ) {
    destinatariosOficiaisCc.push(cadProj.email);
  }

  const assuntoBase = `[R026 - GIMI] Liberação ${rotuloTipo} - Processo ${processo} (Rev. ${rev})`;
  const assuntoEmail = modoTeste ? `[TESTE R026] ${assuntoBase}` : assuntoBase;

  // Trava estrita de segurança Resend: em Modo de Teste envia exclusivamente ao titular sem CC
  const destinatariosFinais = modoTeste ? [...R026_TEST_RECIPIENTS] : destinatariosOficiaisPara;
  const ccFinais = modoTeste
    ? undefined
    : destinatariosOficiaisCc.length > 0
      ? destinatariosOficiaisCc
      : undefined;

  if (destinatariosFinais.length === 0) {
    return res.status(400).json({
      ok: false,
      success: false,
      message: 'Nenhum destinatário configurado para esta categoria de liberação.'
    });
  }

  const htmlCorpo = gerarTemplateEmailR026({
    tipo,
    processo,
    rev,
    itens,
    projetista,
    dataSolicitacao,
    obs,
    modoTeste,
    destinatariosOficiais: destinatariosOficiaisPara,
    interessadosOficiais: destinatariosOficiaisCc
  });

  const textoCorpoLinhas = [
    modoTeste
      ? '[TESTE R026] GIMI | Engenharia & Automação - Notificação Oficial de Liberação de Projeto (R026)'
      : 'GIMI | Engenharia & Automação - Notificação Oficial de Liberação de Projeto (R026)'
  ];

  if (modoTeste) {
    textoCorpoLinhas.push(
      '',
      '--- HOMOLOGAÇÃO DE ROTEAMENTO OFICIAL ---',
      `Destinatários Oficiais (Para): ${destinatariosOficiaisPara.join(', ') || '(Nenhum cadastrado)'}`,
      `Interessados (CC): ${destinatariosOficiaisCc.join(', ') || '(Sem cópias)'}`,
      '-----------------------------------------'
    );
  }

  textoCorpoLinhas.push(
    '',
    `Classificação: ${rotuloTipo}`,
    `Processo / Obra: ${processo}`,
    `Revisão: Rev. ${rev}`,
    `Itens da Obra: ${itens}`,
    `Projetista Responsável: ${projetista}`,
    `Data de Solicitação: ${formatarDataBrR026(dataSolicitacao)}`,
    '',
    'Observações Técnicas:',
    obs || 'Nenhuma observação técnica adicional informada para esta liberação.',
    '',
    'Mensagem automática gerada pela Central R026 - Hub GIMI Engenharia'
  );

  const textoCorpo = textoCorpoLinhas.join('\n');

  const historico = lerHistoricoR026Disco();
  const novoRegistro: any = {
    id: Date.now(),
    data: dataSolicitacao,
    projetista,
    processo,
    itens,
    rev,
    tipo,
    obs: obs || 'Liberação realizada',
    emailStatus: 'Pendente Resend',
    modoTeste,
    emailId: null,
    disparadoEm: new Date().toISOString()
  };

  const cfg = getResendSettings();

  if (!cfg.isConfigured || !cfg.client) {
    const errAusente = { name: 'missing_api_key', message: 'RESEND_API_KEY não configurada no servidor Node.js' };
    console.error('ERRO RESEND DETALHADO:', errAusente);
    novoRegistro.emailStatus = `Erro: ${errAusente.message}`;
    historico.unshift(novoRegistro);
    salvarHistoricoR026Disco(historico);

    return res.status(400).json({
      ok: false,
      success: false,
      message: `Erro Resend: ${errAusente.message}`,
      error: errAusente,
      registro: novoRegistro,
      historico
    });
  }

  try {
    const { data, error } = await cfg.client.emails.send({
      from: 'GIMI Hub <onboarding@resend.dev>',
      to: destinatariosFinais,
      cc: ccFinais,
      subject: assuntoEmail,
      html: htmlCorpo,
      text: textoCorpo
    });

    if (error) {
      console.error('ERRO RESEND DETALHADO:', error);
      novoRegistro.emailStatus = `Erro: ${error.message || 'Falha Resend'}`;
      historico.unshift(novoRegistro);
      salvarHistoricoR026Disco(historico);

      return res.status(400).json({
        ok: false,
        success: false,
        message: `Erro Resend: ${error.message || 'Falha Resend'}`,
        error,
        registro: novoRegistro,
        historico
      });
    }

    novoRegistro.emailStatus = 'E-mail Enviado (Resend)';
    novoRegistro.emailId = data?.id || null;
    historico.unshift(novoRegistro);
    salvarHistoricoR026Disco(historico);

    return res.status(200).json({
      ok: true,
      success: true,
      data,
      registro: novoRegistro,
      historico,
      dispatch: {
        modoTeste,
        resendDispatched: true,
        emailId: novoRegistro.emailId,
        assunto: assuntoEmail,
        para: destinatariosFinais,
        cc: ccFinais ?? [],
        destinatariosOficiais: destinatariosOficiaisPara,
        interessadosOficiais: destinatariosOficiaisCc,
        detail: 'E-mail Enviado (Resend)'
      }
    });
  } catch (err: any) {
    console.error('ERRO RESEND DETALHADO:', err);
    const errMsg = err?.message || 'Falha de comunicação com a API Resend';
    novoRegistro.emailStatus = `Erro: ${errMsg}`;
    historico.unshift(novoRegistro);
    salvarHistoricoR026Disco(historico);

    return res.status(400).json({
      ok: false,
      success: false,
      message: `Erro Resend: ${errMsg}`,
      error: { name: err?.name || 'resend_exception', message: errMsg },
      registro: novoRegistro,
      historico
    });
  }
});

// ==========================================
// ARQUITETURA MODULAR DE FERRAMENTAS INTERNAS (/ferramentas/<slug>)
// ==========================================

// Redirecionamentos legados para as suítes unificadas
app.use('/ferramentas/configurador-chaparia', (_req, res) => {
  res.redirect(301, '/ferramentas/chaparia-com-chapa/');
});
app.use('/ferramentas/estudo-cascateamento', (_req, res) => {
  res.redirect(301, '/ferramentas/eletrica-protecao/');
});
app.use('/ferramentas/configurador-capacitores', (_req, res) => {
  res.redirect(301, '/ferramentas/eletrica-protecao/');
});

// Lista módulos nativos disponíveis na pasta /tools
app.get('/api/internal-tools', (_req, res) => {
  try {
    const entries = fs.readdirSync(TOOLS_DIR, { withFileTypes: true });
    const modules = entries
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(TOOLS_DIR, e.name, 'index.html')))
      .map((e) => ({
        slug: e.name,
        route: `/ferramentas/${e.name}/`
      }));
    res.json({ success: true, modules });
  } catch {
    res.json({ success: true, modules: [] });
  }
});

// Garante barra final (/ferramentas/<slug> -> /ferramentas/<slug>/) para preservar caminhos relativos (./suite.js, ./banco-chaparia.js)
app.use('/ferramentas', (req, res, next) => {
  const cleanSlug = req.path.replace(/^\/+|\/+$/g, '');
  if (cleanSlug && !cleanSlug.includes('/') && !path.extname(cleanSlug) && !req.originalUrl.split('?')[0].endsWith('/')) {
    const moduleDir = path.join(TOOLS_DIR, cleanSlug);
    if (fs.existsSync(moduleDir) && fs.statSync(moduleDir).isDirectory()) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return res.redirect(302, `/ferramentas/${cleanSlug}/${query}`);
    }
  }
  next();
});

// Serve estaticamente qualquer ferramenta adicionada em /tools/<nome-da-ferramenta>/
app.use('/ferramentas', express.static(TOOLS_DIR, { index: 'index.html' }));

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR COM VITE
// ==========================================
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Em produção, serve os arquivos gerados em dist
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ [GIMI Portal Node.js] Servidor rodando na porta ${PORT} (${isProd ? 'Produção' : 'Desenvolvimento'})`);
  });
}

startServer();
