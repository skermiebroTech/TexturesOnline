// Brazilian Portuguese page titles, descriptions and short names (see MetaTranslation in
// src/app/seo/meta.ts).

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_PT_BR: MetaTranslation = {
  pages: {
    '/': {
      title: 'Criar texture pack de Minecraft grátis – Java e Bedrock',
      description: `Crie seu texture pack de Minecraft em minutos: pinte blocos em modelos 3D, aplique estilos com um clique e exporte .zip ou .mcpack. Grátis, Java ${LATEST}.`,
      label: 'Início',
    },
    '/textures': {
      title: 'Editor de texture pack e criador de pacote de recursos',
      description: 'Edite qualquer textura do Minecraft: pinte blocos, itens e mobs em modelos 3D, envie PNGs ou mude o estilo do jogo com um clique. Exporte .zip ou .mcpack.',
      label: 'Texture packs',
    },
    '/texture-pack-converter': {
      title: 'Conversor de texture pack de Minecraft: Java para Bedrock',
      description: 'Converta um texture pack de Minecraft de Java para Bedrock, de Bedrock para Java ou entre versões do Java, ou transforme PNGs em .mcpack. Grátis e online.',
      label: 'Conversor de texture pack',
    },
    '/merge-texture-packs': {
      title: 'Juntar texture packs de Minecraft online – Java e Bedrock',
      description: 'Junte vários texture packs de Minecraft em um único .zip ou .mcpack. Coloque em ordem e o pack de cima vence, como no jogo. Grátis, no seu navegador.',
      label: 'Juntar texture packs',
    },
    '/pack-doctor': {
      title: 'Consertar texture pack de Minecraft quebrado – Pack Doctor',
      description: 'Texture pack não funciona? O Pack Doctor verifica seu pack do Java ou Bedrock, explica cada problema e conserta com um clique. Grátis.',
      label: 'Pack Doctor',
    },
    '/totem-maker': {
      title: 'Criador de totem da imortalidade personalizado – Minecraft',
      description: 'Transforme qualquer skin de Minecraft em um totem da imortalidade: envie um PNG ou digite um nome, escolha o estilo e baixe um .zip do Java ou um .mcpack.',
      label: 'Criador de totens',
    },
    '/font-maker': {
      title: 'Criador de fontes do Minecraft – Pacote de fonte grátis',
      description: 'Crie uma fonte própria para o Minecraft: desenhe letras em pixels ou converta uma TTF/OTF, teste no chat, em placas e livros, e baixe .zip ou .mcpack.',
      label: 'Criador de fontes',
    },
    '/skins': {
      title: 'Editor de skin de Minecraft e criador de pacote de skins',
      description: 'Pinte uma skin de Minecraft em 2D ou 3D, com braços clássicos ou finos, e exporte um PNG para Java ou um pacote de skins do Bedrock (.mcpack). Grátis.',
      label: 'Skins',
    },
    '/skin-pack-maker': {
      title: 'Criar pacote de skins de Minecraft grátis (.mcpack Bedrock)',
      description: 'Crie seu pacote de skins de Minecraft online: pinte ou envie skins, misture braços clássicos e finos e baixe um .mcpack do Bedrock pronto para o jogo.',
      label: 'Criador de pacote de skins',
    },
    '/cape-maker': {
      title: 'Criador de capas de Minecraft – faça capa e élitros',
      description: 'Crie uma capa de Minecraft e os élitros no modelo de 64×32 com prévia 3D. Baixe o PNG ou um texture pack de élitros. Grátis e sem cadastro.',
      label: 'Criador de capas',
    },
    '/shaders': {
      title: 'Criar shaders de Minecraft: Iris, OptiFine e sem mods',
      description: 'Crie shader packs para Iris ou OptiFine, shaders vanilla sem mods para Java ou pacotes de Visuais Vibrantes para Bedrock, com presets e prévia 3D ao vivo.',
      label: 'Shaders',
    },
    '/help': {
      title: 'Como instalar texture packs, skins e shaders no Minecraft',
      description: 'Instale texture packs, skins e shaders no Minecraft Java e Bedrock no PC, Mac, celular e console, ache a pasta resourcepacks e resolva erros comuns.',
      label: 'Ajuda',
    },
    '/about': {
      title: 'Sobre o Texture Pack Maker: ferramentas grátis e abertas',
      description: 'Quem faz o Texture Pack Maker, o que o torna diferente (toda versão do Java desde 1.6.1, Bedrock, conversor, código aberto) e como protege seu trabalho.',
      label: 'Sobre',
    },
    '/privacy': {
      title: 'Política de privacidade – Texture Pack Maker',
      description: 'O Texture Pack Maker não tem contas, anúncios nem rastreamento. Seus packs, skins e shaders ficam no seu dispositivo e nada do que você cria é enviado.',
      label: 'Privacidade',
    },
    '/all': {
      title: 'Todas as ferramentas de Minecraft: packs, skins e shaders',
      description: 'Todas as ferramentas, recursos e guias grátis do Texture Pack Maker em um só lugar: texture packs, modelos 3D, sons, skins e shaders.',
      label: 'Tudo no site',
    },
    '/guides': {
      title: 'Guias de Minecraft: texture packs, skins e shaders',
      description: `Guias passo a passo para criar e instalar texture packs, skins e shaders de Minecraft, além do pack format de cada versão do Java de 1.6.1 a ${LATEST}.`,
      label: 'Guias',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'Como fazer um texture pack de Minecraft (Java e Bedrock)',
      h1: 'Como fazer um texture pack de Minecraft',
      description: 'Crie seu texture pack de Minecraft grátis: escolha a versão, pinte texturas, exporte um .zip com pack.mcmeta (Java) ou um .mcpack (Bedrock) e instale.',
      label: 'Fazer um texture pack',
      blurb: 'Escolha a versão, pinte texturas e exporte um pack que o Minecraft carrega.',
    },
    'install-resource-packs': {
      title: 'Como instalar texture pack no Minecraft (Java e Bedrock)',
      h1: 'Como instalar texture packs, shaders e arquivos .mcpack no Minecraft',
      description: 'Instale um pacote de recursos no Java, importe um .mcpack do Bedrock no PC ou celular, use shaders com Iris ou OptiFine e resolva packs que não aparecem.',
      label: 'Instalar packs e shaders',
      blurb: 'Pacotes de recursos do Java, arquivos .mcpack do Bedrock e shader packs, com soluções.',
    },
    'texture-pack-not-working': {
      title: 'Texture pack do Minecraft não funciona? Veja as soluções',
      h1: 'Texture pack do Minecraft não funciona? Como resolver',
      description: 'Pack não aparece na lista, “versão mais antiga”, blocos roxos e pretos, grama cinza, .mcpack que não importa: o que significa cada problema e a solução.',
      label: 'Pack não funciona? Soluções',
      blurb: 'Packs que não aparecem, avisos de versão, blocos roxos e pretos e mais.',
    },
    'minecraft-pack-format-versions': {
      title: `Pack format do Minecraft ${LATEST} (${F(LATEST)}) e todas as versões`,
      h1: `Pack format do Minecraft para cada versão do Java (${LATEST} usa ${F(LATEST)})`,
      description: `Cada versão do Minecraft Java de 1.6.1 a ${LATEST} com o formato do pacote de recursos (${LATEST} usa ${F(LATEST)}) e como o pack.mcmeta mudou ao longo dos anos.`,
      label: 'Pack format de cada versão',
      blurb: `O pack format de cada versão do Java, de 1.6.1 a ${LATEST}.`,
    },
    'make-a-skin': {
      title: 'Como fazer uma skin de Minecraft (Java e Bedrock)',
      h1: 'Como fazer sua própria skin de Minecraft',
      description: 'Faça uma skin de Minecraft grátis: pinte o modelo 64×64 ou HD 128×128 em 2D ou 3D, escolha braços clássicos ou finos e use no Java ou no Bedrock.',
      label: 'Fazer uma skin',
      blurb: 'Pinte o modelo 64×64 ou HD 128×128 para o Java ou um pacote de skins do Bedrock.',
    },
    'make-shaders-without-mods': {
      title: 'Shaders de Minecraft sem mods nem OptiFine (Java e Bedrock)',
      h1: 'Dá para ter shaders no Minecraft sem mods?',
      description: 'Sim: no Java 1.17+ um pacote de recursos troca os shaders do jogo (sem OptiFine ou Iris) e o Bedrock tem Visuais Vibrantes. O que dá para fazer e como.',
      label: 'Shaders sem mods',
      blurb: 'O que os shaders vanilla do Java e os Visuais Vibrantes do Bedrock conseguem fazer.',
    },
    'java-vs-bedrock-packs': {
      title: 'Texture packs Java vs Bedrock: diferenças e compatibilidade',
      h1: 'Texture packs do Java vs Bedrock: diferenças e como converter',
      description: 'Texture packs do Java funcionam no Bedrock? Não: o Java usa .zip + pack.mcmeta e o Bedrock .mcpack + manifest.json. Pastas, nomes, shaders e skins.',
      label: 'Packs do Java vs Bedrock',
      blurb: 'Arquivos, pastas, formatos, shaders e skins comparados lado a lado.',
    },
    'bedrock-vibrant-visuals-settings': {
      title: 'Configurações dos Visuais Vibrantes no Minecraft Bedrock',
      h1: 'Configurações dos Visuais Vibrantes do Bedrock explicadas',
      description: 'O que um pacote de Visuais Vibrantes muda no Bedrock (sol, céu, neblina, água, sombras e cor), quais aparelhos suportam e como ativar.',
      label: 'Configurações dos Visuais Vibrantes',
      blurb: 'Sol, céu, neblina, água e cor, e os aparelhos compatíveis.',
    },
    'convert-java-to-bedrock-texture-pack': {
      title: 'Como converter texture pack do Java para o Bedrock',
      h1: 'Como converter um texture pack do Java para o Bedrock',
      description: 'Converta grátis um texture pack do Minecraft Java em um .mcpack do Bedrock (ou do Bedrock para o Java): o que converte, o que não converte e como instalar.',
      label: 'Converter Java para Bedrock',
      blurb: 'Transforme um pack do Java em um .mcpack do Bedrock, ou o contrário, em poucos cliques.',
    },
    'merge-texture-packs': {
      title: 'Como juntar texture packs de Minecraft (Java e Bedrock)',
      h1: 'Como juntar texture packs de Minecraft',
      description: 'Junte vários texture packs de Minecraft em um só para um servidor, um Realm ou para compartilhar: qual pack vence, o que é combinado, online ou à mão.',
      label: 'Juntar texture packs',
      blurb: 'Junte vários packs em um só, na ordem que você escolher.',
    },
    'make-a-bedrock-skin-pack': {
      title: 'Como fazer um pacote de skins do Minecraft Bedrock',
      h1: 'Como fazer um pacote de skins (skin pack) do Minecraft Bedrock',
      description: 'Crie um pacote de skins para o Minecraft Bedrock: pinte ou envie skins, exporte um .mcpack, importe no PC ou celular, atualize ou monte os arquivos à mão.',
      label: 'Pacote de skins do Bedrock',
      blurb: 'Junte suas skins em um .mcpack e use pelo Vestiário.',
    },
    'make-3d-items-texture-pack': {
      title: 'Como fazer itens 3D em um texture pack de Minecraft',
      h1: 'Como fazer itens 3D e modelos próprios em um texture pack de Minecraft',
      description: 'Transforme itens planos do Minecraft em modelos 3D e mude a forma de blocos em um pack do Java: JSON de modelos, definições de item 1.21.4+ e soluções.',
      label: 'Fazer itens 3D',
      blurb: 'Transforme itens planos em modelos 3D e mude a forma de blocos, arquivo por arquivo.',
    },
    'make-a-pvp-texture-pack': {
      title: 'Como fazer um texture pack de PvP (Java e Bedrock)',
      h1: 'Como fazer um texture pack de PvP para Minecraft',
      description: 'Faça grátis um texture pack de PvP do Minecraft: fogo baixo, vidro transparente, espadas menores, mira própria e texturas 8× para FPS, do 1.8.9 ao 26.3.',
      label: 'Fazer um pack de PvP',
      blurb: 'Fogo baixo, vidro transparente, espadas menores, mira e texturas para FPS.',
    },
  },
};
