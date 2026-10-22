// Brazilian Portuguese home page (see HomeText in src/tools/home/content.ts).

import { el } from '../../app/markup';
import { link } from '../../app/content/blocks';
import { F, LATEST } from '../../app/content/facts';
import type { HomeText } from '../../tools/home/content';

const code = (t: string) => el('code', null, t);

export const HOME: HomeText = {
  tools: {
    textures: {
      title: 'Texture packs',
      blurb: 'Repinte qualquer bloco, item ou mob, ou mude o estilo do jogo inteiro com um clique.',
      features: ['Todas as texturas, qualquer versão', 'Editor de pixels e efeitos', 'Abra packs que você já tem'],
      cta: 'Criar um texture pack',
      previewLabel: '',
    },
    skins: {
      title: 'Skins',
      blurb: 'Pinte seu jogador no modelo 64×64 enquanto um modelo 3D se atualiza ao vivo.',
      features: ['Clássica e fina, duas camadas', 'Modelos ou qualquer nome de usuário', 'Exporta para Java e Bedrock'],
      cta: 'Criar uma skin',
      previewLabel: 'Pinte pixel por pixel',
    },
    shaders: {
      title: 'Shaders',
      blurb: 'Ajuste luz, cor, neblina e água com controles e uma prévia ao vivo.',
      features: ['Packs para Iris / OptiFine', 'Shaders vanilla sem mods', 'Visuais Vibrantes do Bedrock'],
      cta: 'Criar um shader',
      previewLabel: 'Prévia de dia e de noite',
    },
  },
  faq: [
    {
      id: 'how',
      q: 'Como eu faço um texture pack de Minecraft?',
      a: [
        el(
          'p',
          null,
          'Abra o ',
          link('/textures', 'editor de texture pack'),
          ', escolha Java ou Bedrock e a versão do seu jogo, depois repinte texturas, envie suas próprias imagens ou aplique um efeito com um clique. Exporte um ',
          code('.zip'),
          ' (Java) ou um ',
          code('.mcpack'),
          ' (Bedrock) e ative no jogo. ',
          link('/guides/make-a-texture-pack', 'Guia passo a passo'),
          '.',
        ),
      ],
    },
    {
      id: 'what',
      q: 'O que é o Texture Pack Maker?',
      a: [
        el(
          'p',
          null,
          'O Texture Pack Maker é um site grátis para criar texture packs, skins e shaders de Minecraft. Tudo roda no seu navegador: escolha uma versão do jogo, edite com prévias ao vivo e baixe um pack pronto para Java ou Bedrock.',
        ),
      ],
    },
    {
      id: 'free',
      q: 'É grátis? Preciso de uma conta?',
      a: [el('p', null, 'É grátis, não tem conta nem cadastro, e o código é aberto sob a licença MIT. Seus projetos ficam no seu próprio dispositivo.')],
    },
    {
      id: 'bedrock',
      q: 'Funciona com o Minecraft Bedrock?',
      a: [
        el(
          'p',
          null,
          'Sim. Texture packs e skins são exportados como arquivos ',
          code('.mcpack'),
          ' que o Bedrock importa quando você abre, e o Shader Maker cria pacotes de Visuais Vibrantes. Veja ',
          link('/guides/java-vs-bedrock-packs', 'como os packs do Java e do Bedrock são diferentes'),
          '.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Para quais versões do Java posso criar packs?',
      a: [
        el(
          'p',
          null,
          `O Java ${LATEST} já vem selecionado, e todas as versões até a 1.6.1 funcionam. Cada pack recebe as regras do `,
          code('pack.mcmeta'),
          ` da versão escolhida (a ${LATEST} usa o formato de pacote de recursos ${F(LATEST)}). `,
          link('/guides/minecraft-pack-format-versions', 'Todos os pack formats'),
          '.',
        ),
      ],
    },
    {
      id: 'resource',
      q: 'Texture pack é a mesma coisa que pacote de recursos?',
      a: [
        el(
          'p',
          null,
          'Quase. O Java Edition chama de pacotes de recursos: além de texturas, eles podem mudar modelos, sons, fontes e shaders. O Bedrock também chama de pacotes de recursos e usa arquivos ',
          code('.mcpack'),
          '. Esta ferramenta cria os dois.',
        ),
      ],
    },
    {
      id: 'skinpack',
      q: 'Posso criar meu próprio pacote de skins?',
      a: [
        el(
          'p',
          null,
          'Sim. Pinte suas skins (braços clássicos ou finos) no ',
          link('/skins', 'editor de skins'),
          ' e exporte todas juntas em um pacote de skins do Bedrock, ou baixe um PNG para o Java. ',
          link('/skin-pack-maker', 'Criador de pacote de skins'),
          '.',
        ),
      ],
    },
    {
      id: 'install',
      q: 'Preciso instalar alguma coisa?',
      a: [el('p', null, 'Não. Funciona em qualquer navegador atual no computador, celular ou tablet. Depois da primeira visita, o app continua funcionando offline.')],
    },
  ],
  appFeatures: [
    `Criador de texture packs de Minecraft para Java Edition (${LATEST} e todas as versões desde a 1.6.1) e Bedrock Edition`,
    'Editor de skins de Minecraft com prévia 3D ao vivo, modelos clássico e fino, exportação em PNG para Java e pacote de skins para Bedrock',
    'Criador de shaders para shader packs de Iris / OptiFine, shaders vanilla do Java sem mods e pacotes de Visuais Vibrantes do Bedrock',
    'Exporta arquivos .zip e .mcpack prontos para usar, com o pack.mcmeta ou o manifest.json certos',
    'Roda no navegador: sem cadastro, sem upload e offline depois da primeira visita',
  ],
  hero: {
    chip: 'Grátis · Sem cadastro',
    chipOffline: ' · Funciona offline',
    title: { pre: 'Crie texture packs de ', accent: 'Minecraft' },
    lead: 'Crie seus próprios texture packs, skins e shaders direto no navegador: um criador de pacotes de recursos grátis para Java e Bedrock, com downloads prontos para colocar no jogo.',
    start: 'Começar a criar',
    install: 'Como instalar',
    everything: 'Veja tudo o que você pode criar',
    editionsLabel: 'Edições compatíveis',
    chips: [`Java ${LATEST}`, 'Todas as versões 1.6.1+', 'Bedrock'],
    blockLabel: 'Um bloco de grama em pixel art',
    dragHint: 'Arraste para girar',
  },
  toolsSection: {
    eyebrow: 'Três ferramentas, um só lugar',
    title: 'O que você quer criar?',
    lead: 'Tudo o que você precisa para dar ao Minecraft o seu estilo. Sem instalar nada e sem conta: é só abrir uma ferramenta e começar.',
  },
  converter: {
    title: 'Conversor de texture pack',
    text: `Transforme um pack do Java em um do Bedrock ou o contrário, atualize um pack antigo para a ${LATEST} ou transforme PNGs em um .mcpack.`,
    cta: 'Converter um pack',
  },
  features: {
    eyebrow: 'Criador de packs grátis',
    title: 'Tudo o que um criador de texture pack precisa',
    lead: 'De uma única espada repintada a um pacote de recursos HD completo, criado e exportado sem sair do navegador.',
    titles: [
      'Editor de texture pack com modelos 3D',
      'Gerador de texture pack com um clique',
      'Abra e edite packs existentes',
      'Pacotes de recursos para Java e Bedrock',
      'Editor de skins e criador de pacote de skins',
      'Criador de shaders, com ou sem mods',
    ],
    items: [
      ['Pinte cada bloco, item e mob da sua versão direto no modelo 3D real: fornalhas, baús, escadas e mais de 80 mobs, de creepers a aldeões.'],
      ['Mude o estilo do jogo inteiro de uma vez com efeitos como Dark Mode, Pastel, Retro 8-bit, Autumn ou Smooth HD, e depois ajuste à mão.'],
      ['Carregue qualquer ', code('.zip'), ' do Java ou ', code('.mcpack'), ' do Bedrock e continue editando, ou passe para a outra edição com o ', link('/texture-pack-converter', 'conversor de packs'), '.'],
      ['Um gerador de pacotes de recursos que escreve o ', code('pack.mcmeta'), ` exato para o Java ${LATEST} até a 1.6.1, ou um `, code('manifest.json'), ' do Bedrock.'],
      ['Crie skins em 2D ou 3D com braços clássicos ou finos e junte tudo com o ', link('/skin-pack-maker', 'criador de pacote de skins'), ' em um único .mcpack do Bedrock.'],
      ['Crie shader packs para Iris e OptiFine, shaders vanilla do Java que não precisam de mods ou pacotes de Visuais Vibrantes para o Bedrock.'],
    ],
  },
  why: {
    eyebrow: 'Por que é diferente',
    title: 'Por que o Texture Pack Maker?',
    lead: ['Grátis, de código aberto e privado, com todas as versões do Java desde a 1.6.1, Bedrock e nove ferramentas em um só lugar. ', link('/about', 'Sobre o projeto'), '.'],
  },
  how: {
    eyebrow: 'Como funciona',
    title: 'Da ideia ao jogo em minutos',
    steps: [
      { title: 'Escolha seu jogo', text: `O Java ${LATEST} já vem pronto, ou escolha qualquer versão do Java até a 1.6.1, ou o Bedrock.` },
      { title: 'Crie', text: 'Pinte pixels, combine efeitos de um clique ou mexa nos controles de shader, com prévias 3D ao vivo.' },
      { title: 'Exporte e jogue', text: 'Baixe um .zip ou .mcpack pronto para usar e siga o guia de instalação para usar no jogo.' },
    ],
    values: [
      { title: 'Privado por natureza', text: 'Seu trabalho nunca sai do seu dispositivo. Os arquivos do jogo são baixados da Mojang pelo seu próprio navegador.' },
      { title: 'Funciona offline', text: 'Depois da primeira visita, o app e os arquivos do jogo baixados ficam guardados neste dispositivo.' },
      { title: 'Sempre o formato certo', text: 'Os arquivos do pack são escritos para a versão exata que você escolher, e o Minecraft carrega sem reclamar.' },
    ],
  },
  guides: { eyebrow: 'Guias', title: 'Aprenda o básico', lead: 'Guias curtos e conferidos para criar e instalar packs, skins e shaders.', all: 'Todos os guias' },
  faqHead: { eyebrow: 'Perguntas', title: 'É bom saber' },
  cta: { title: 'Pronto para criar algo?', text: 'Escolha uma ferramenta e seu primeiro pack pode estar no jogo em poucos minutos.', button: 'Começar a criar' },
  startDialog: 'O que você quer criar?',
};
