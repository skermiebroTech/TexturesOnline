// Brazilian Portuguese About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: 'Todas as versões do Java desde a 1.6.1',
      text: [`Não só a mais nova: faça um pack para a ${LATEST}, 1.21.11, 1.20.1 ou 1.8.9, cada uma com as próprias texturas e o pack.mcmeta certo.`],
    },
    {
      title: 'Java e Bedrock, e um conversor',
      text: ['Crie packs para qualquer uma das edições e transforme um pack do Java em um do Bedrock, ou o contrário, com o ', link('/texture-pack-converter', 'conversor de texture pack'), '.'],
    },
    {
      title: 'Texturas, skins e shaders',
      text: ['Um só site para texture packs, skins e pacotes de skins, e shaders para Iris, OptiFine, Java vanilla e Visuais Vibrantes do Bedrock.'],
    },
    {
      title: 'Nada é enviado',
      text: ['Tudo roda no seu navegador. Os arquivos do jogo vêm direto da Mojang e o seu trabalho fica no seu dispositivo.'],
    },
    {
      title: 'Grátis e de código aberto',
      text: ['Sem conta, sem anúncios e sem planos pagos. O código é público sob a licença MIT no ', ext(REPO_URL, 'GitHub'), '.'],
    },
    {
      title: 'Funciona offline',
      text: ['Depois da primeira visita, o app e os arquivos do jogo que você usou ficam no seu dispositivo, então ele continua funcionando sem conexão.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: 'Quem faz o Texture Pack Maker?',
      a: [el('p', null, `O Texture Pack Maker é feito por ${PUBLISHER.name}, um criador independente. É uma ferramenta feita por fãs e não tem vínculo com a Mojang nem com a Microsoft.`)],
    },
    {
      id: 'cost',
      q: 'Custa alguma coisa?',
      a: [el('p', null, 'Não. Todas as ferramentas são grátis, sem conta, sem anúncios e sem limite de quantos packs você faz.')],
    },
    {
      id: 'files',
      q: 'De onde vêm as texturas do Minecraft?',
      a: [
        el(
          'p',
          null,
          'Seu navegador baixa as texturas da Mojang quando você escolhe uma versão: as do Java, dos arquivos oficiais do jogo, e as do Bedrock, do repositório ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' da Mojang. Elas ficam no seu dispositivo e nunca são guardadas neste site.',
        ),
      ],
    },
    {
      id: 'contact',
      q: 'Como eu relato um bug ou sugiro um recurso?',
      a: [el('p', null, 'Abra uma issue no ', ext(`${REPO_URL}/issues`, 'GitHub'), '. Diga qual ferramenta, edição e versão você estava usando.')],
    },
  ],
  eyebrow: 'Sobre',
  title: 'Sobre o Texture Pack Maker',
  intro: `O Texture Pack Maker é um site grátis e de código aberto para criar texture packs, skins e shaders de Minecraft no navegador, para o Java Edition (${LATEST} e todas as versões até a 1.6.1) e o Bedrock Edition. Ele é feito por ${PUBLISHER.name}.`,
  differentTitle: 'O que torna o Texture Pack Maker diferente',
  toolsTitle: 'As ferramentas',
  tools: [
    [link('/textures', 'Criador de texture pack'), ': repinte qualquer bloco, item ou mob no modelo 3D, envie suas próprias imagens, troque sons, mude o estilo do pack inteiro com um clique ou abra um pack existente.'],
    [link('/texture-pack-converter', 'Conversor de texture pack'), ': Java para Bedrock, Bedrock para Java, entre versões do Java ou de texturas PNG para um .mcpack.'],
    [link('/merge-texture-packs', 'Juntar texture packs'), ': junte até oito packs em um só, na ordem que você escolher.'],
    [link('/totem-maker', 'Criador de totens'), ': transforme qualquer skin em um totem da imortalidade personalizado, como pacote de recursos para Java ou Bedrock.'],
    [link('/skins', 'Editor de skins'), ' e ', link('/skin-pack-maker', 'criador de pacote de skins'), ': pinte skins em 2D ou 3D com braços clássicos ou finos e junte tudo em um pacote de skins do Bedrock.'],
    [link('/shaders', 'Criador de shaders'), ': shader packs para Iris e OptiFine, shaders vanilla do Java que não precisam de mods e pacotes de Visuais Vibrantes para o Bedrock.'],
    [link('/guides', 'Guias'), ': como criar, instalar e consertar packs, e o pack format de cada versão do Java.'],
  ],
  howTitle: 'Como funciona',
  how: [
    'Quando você escolhe uma versão do jogo, seu navegador baixa as texturas dessa versão direto da Mojang e guarda no seu dispositivo. Seus projetos também ficam salvos no navegador (IndexedDB), e as exportações são feitas no seu dispositivo: um ',
    code('.zip'),
    ' do Java com o ',
    code('pack.mcmeta'),
    ` certo (o Java ${LATEST} usa o pack format ${F(LATEST)}) ou um `,
    code('.mcpack'),
    ' do Bedrock com um ',
    code('manifest.json'),
    '. Nada do que você faz é enviado para um servidor.',
  ],
  makerTitle: 'Quem faz',
  maker: ['O Texture Pack Maker é feito por ', strong(PUBLISHER.name), '. O código-fonte é público, então qualquer pessoa pode ver como funciona, sugerir mudanças ou relatar problemas.'],
  notOfficial: 'Não é um produto oficial do Minecraft. Não é aprovado pela Mojang ou pela Microsoft nem tem vínculo com elas.',
  questions: 'Perguntas frequentes',
};
