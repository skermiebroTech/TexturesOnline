// Brazilian Portuguese guides (see GuideText in src/tools/guides/content.ts). Facts come from the
// app data (src/app/content/facts.ts), menu names from the Brazilian Portuguese game files.

import { el, type Child, type ElNode } from '../../app/markup';
import { callout, code, ext, figure, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SHOTS } from './shots';
import { UI_PT_BR } from './ui';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../tools/guides/skin-pack-files';

const p = (...c: Child[]): ElNode => el('p', null, ...c);
const ul = (items: Child[]): ElNode => el('ul', { class: 'guide-list' }, items.map((i) => el('li', null, i)));
const pre = (text: string): ElNode => el('pre', { class: 'guide-code' }, el('code', null, text));
const h3 = (text: string): ElNode => el('h3', { class: 'guide-sub' }, text);
const table = (head: string[], rows: Child[][], cls = 'guide-table'): ElNode =>
  el(
    'div',
    { class: 'table-scroll' },
    el(
      'table',
      { class: cls },
      el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', null, c)))))),
    ),
  );
const FOLDER = UI_PT_BR.folderTable;
const OPTIONS = 'Opções...';
const PACKS = 'Pacotes de recursos...';
const OPEN_FOLDER = 'Abrir pasta de pacotes';
const VIDEO = 'Gráficos...';
const IRIS_SHADERS = 'Pacote de sombreadores...';

export const GUIDES_INDEX: GuidesIndexText = {
  eyebrow: 'Guias',
  title: 'Guias de texture packs, skins e shaders de Minecraft',
  lead: 'Respostas claras e conferidas para criadores de Minecraft: como fazer e instalar texture packs, skins e shaders no Java e no Bedrock, e qual pack format cada versão do Java precisa.',
  more: ['Procurando instruções de instalação passo a passo para cada plataforma? Veja o ', link('/help', 'guia de instalação e perguntas frequentes'), '.'],
};

// ---------------------------------------------------------------- shared steps

const MAKE_PACK_STEPS: Child[] = [
  ['Abra o ', link('/textures', 'Texture Pack Maker'), ', dê um nome ao pack e escolha Java ou Bedrock, a versão que você joga e uma resolução, depois clique em ', strong('Create pack'), '.'],
  'Ache uma textura pela busca ou pelas categorias e repinte no editor de pixels, ou envie seu próprio PNG.',
  'Opcional: mude o estilo do pack inteiro com efeitos de um clique como Dark Mode, Pastel ou Retro 8-bit.',
  ['Abra a aba ', strong('Pack'), ' para definir a descrição e o ícone, depois exporte um ', code('.zip'), ' (Java) ou um ', code('.mcpack'), ' (Bedrock).'],
  ['Instale o pack no Minecraft e teste. ', link('/guides/install-resource-packs', 'Como instalar'), '.'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Abra o Minecraft Java Edition e vá em ', uiPath(OPTIONS, PACKS), '.'],
  ['Clique em ', uiPath(OPEN_FOLDER), '. A pasta ', code('resourcepacks'), ' abre.'],
  ['Coloque o ', code('.zip'), ' do pack na pasta (sem descompactar). Você também pode arrastar para a tela de pacotes de recursos.'],
  ['Mova o pack de ', strong('Disponíveis'), ' para ', strong('Selecionados'), ' com a seta e coloque no topo se usar vários packs. Clique em ', strong('Concluído'), '.'],
];

const SKIN_STEPS: Child[] = [
  ['Abra o ', link('/skins', 'Skin Maker'), ' e escolha um ponto de partida: uma skin em branco, um modelo colorido por partes, um personagem inicial, um PNG que você já tem, a skin de um jogador do Java pelo nome de usuário ou uma das skins padrão.'],
  'Escolha o tipo de braço: clássico (4 pixels de largura) ou fino (3 pixels).',
  'Pinte no modelo 64×64 ou mude para 3D e pinte direto no modelo, escondendo partes do corpo para alcançar os lados de baixo. Use o espelhamento para pintar os dois braços ou as duas pernas de uma vez e bloqueie as partes que já terminou.',
  'Dê profundidade com a camada externa: chapéus, cabelo, jaquetas, mangas e pernas da calça ficam um pouco acima do corpo.',
  ['Exporte um ', code('.png'), ' para o Java (mais uma cópia 64×32 para a 1.7.10 e anteriores) ou um pacote de skins ', code('.mcpack'), ' para o Bedrock.'],
  'Envie: no Minecraft Launcher (Java) ou abrindo o .mcpack e escolhendo a skin no Vestiário (Bedrock).',
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Abra o ', link('/shaders', 'Shader Maker'), ' e escolha ', strong('Java vanilla'), '.'],
  `Escolha exatamente a versão do Minecraft que você joga (Java 1.17 ou mais novo; a ${LATEST} é o padrão).`,
  'Comece com um preset e ajuste brilho, contraste, cor, vinheta e neblina enquanto a prévia se atualiza.',
  ['Exporte o ', code('.zip'), ' e instale como qualquer pacote de recursos: ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), '.'],
];

// ---------------------------------------------------------------- guides

const makeATexturePack: GuideText = {
  image: SHOTS.editor,
  intro: [
    p(
      'Um texture pack de Minecraft troca as imagens do jogo (blocos, itens, mobs, o céu e os menus) pelas suas. O Java Edition chama texture packs de ',
      el('em', null, 'pacotes de recursos'),
      ': um ',
      code('.zip'),
      ' com um arquivo ',
      code('pack.mcmeta'),
      ' e imagens PNG nos mesmos caminhos das originais. O Bedrock usa arquivos ',
      code('.mcpack'),
      ' com um ',
      code('manifest.json'),
      '. Dá para fazer qualquer um dos dois no navegador em poucos minutos.',
    ),
  ],
  quick: {
    title: 'Resumindo',
    items: ['Escolha Java ou Bedrock e a versão que você joga.', 'Repinte texturas, envie suas próprias imagens ou aplique um efeito de um clique.', 'Exporte o pack e coloque no Minecraft.'],
  },
  howto: { name: 'Como fazer um texture pack de Minecraft com o Texture Pack Maker', steps: MAKE_PACK_STEPS },
  sections: [
    {
      id: 'step-1',
      title: 'Passo 1: crie o pack e escolha sua versão',
      body: [
        p(MAKE_PACK_STEPS[0]),
        ul([
          [strong('Edição: '), 'Java Edition (PC, Mac e Linux pelo Minecraft Launcher) ou Bedrock Edition (Windows, celulares, tablets e consoles). As duas precisam de arquivos diferentes, então faça um projeto para cada edição. ', link('/guides/java-vs-bedrock-packs', 'Qual eu tenho?')],
          [strong('Versão: '), `o Java ${LATEST} já vem selecionado; todas as versões até a 1.6.1 funcionam, então dá para fazer um pack para a 1.21.11, 26.2 ou 1.8.9 com a mesma facilidade. O pack recebe o `, code('pack.mcmeta'), ' certo para essa versão.'],
          [strong('Resolução: '), '16× é o visual vanilla (16×16 pixels por face de bloco). 32× e 64× deixam espaço para mais detalhes; 128× ou mais são para packs realistas.'],
        ]),
        p('Depois o seu navegador baixa as texturas originais dessa versão direto da Mojang e guarda no seu dispositivo, então o próximo pack começa na hora.'),
        figure(SHOTS.newPack),
      ],
    },
    {
      id: 'step-2',
      title: 'Passo 2: ache e repinte texturas',
      body: [
        p(MAKE_PACK_STEPS[1]),
        p(
          'Cada textura aparece no seu modelo 3D real: uma fornalha mostra a frente, as laterais e o topo, escadas e lajes mostram o formato, e os mobs mostram as partes do corpo. Pinte com lápis, balde, linha, formas, ruído e seletor de cor, espelhe os traços e desfaça o que quiser. A prévia em mosaico mostra como um bloco se repete no chão, para as emendas não aparecerem.',
        ),
        p(
          'Prefere ver o bloco enquanto pinta? Mude o editor para ',
          strong('3D'),
          ' (ou aperte D) e pinte direto no modelo: cada face pinta a textura que mostra. Arraste o fundo ou use dois dedos para girar o bloco. As texturas de mobs funcionam do mesmo jeito: escolha Mobs na lista de texturas e esconda partes do corpo para alcançar os lados de baixo.',
        ),
        ul([
          'Comece pelos blocos que você vê o tempo todo: grama, terra, pedra, troncos e tábuas.',
          'Grama, folhas, trepadeiras e água são guardadas em cinza e coloridas pelo jogo conforme o bioma. Mantenha em cinza-claro.',
          'Texturas animadas, como água, lava e lanternas marinhas, podem ser editadas quadro a quadro.',
        ]),
        figure(SHOTS.editor),
      ],
    },
    {
      id: 'step-3',
      title: 'Passo 3: mude o estilo do pack inteiro com um clique (opcional)',
      body: [
        p(MAKE_PACK_STEPS[2]),
        p('Os efeitos se empilham uns sobre os outros e sobre a sua pintura sem mudá-la, e são aplicados a todas as texturas na exportação. Combine Autumn com Smooth HD, ou Dark Mode com Neon Outline, e continue pintando à mão.'),
        figure(SHOTS.effects),
      ],
    },
    {
      id: 'step-4',
      title: 'Passo 4: adicione um ícone e uma descrição e exporte',
      body: [
        p(MAKE_PACK_STEPS[3]),
        p(
          'No Java você também pode escolher uma faixa de compatibilidade, para um pack carregar em várias versões sem o aviso de “feito para uma versão mais antiga”. A exportação escreve todos os arquivos de que o jogo precisa: ',
          code('pack.mcmeta'),
          ' e ',
          code('pack.png'),
          ' no Java, ou ',
          code('manifest.json'),
          ' com IDs únicos novos e ',
          code('pack_icon.png'),
          ' no Bedrock.',
        ),
        figure(SHOTS.packSettings),
        figure(SHOTS.export),
      ],
    },
    {
      id: 'step-5',
      title: 'Passo 5: instale e teste',
      body: [
        p(MAKE_PACK_STEPS[4]),
        ul([
          ['Java: abra ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', coloque o ', code('.zip'), ' lá (sem descompactar) e mova o pack para ', strong('Selecionados'), '. Aperte F3 + T no jogo para recarregar depois de mudanças.'],
          ['Bedrock: abra o ', code('.mcpack'), ' e ative em ', uiPath('Opções', 'Recursos globais'), '.'],
        ]),
        p('Alguma coisa ficou estranha? ', link('/guides/texture-pack-not-working', 'Texture pack não funciona: soluções'), '.'),
      ],
    },
    {
      id: 'inside',
      title: 'O que tem dentro de um texture pack?',
      body: [
        h3('Java Edition (.zip)'),
        ul([
          [code('pack.mcmeta'), ' na raiz do zip (obrigatório): a descrição do pack e as versões do jogo para as quais ele foi feito.'],
          [code('pack.png'), ' (opcional): o ícone na lista de packs. O do Minecraft tem 128×128 e é mostrado em 32×32.'],
          [code('assets/minecraft/textures/…'), ': suas imagens, com as mesmas pastas e nomes de arquivo das originais, por exemplo ', code('assets/minecraft/textures/block/stone.png'), '. Versões anteriores à 1.13 usam as pastas ', code('blocks'), ' e ', code('items'), ' em vez de ', code('block'), ' e ', code('item'), '.'],
          ['Texturas animadas têm um arquivo ', code('.png.mcmeta'), ' correspondente ao lado da imagem.'],
        ]),
        h3('Bedrock Edition (.mcpack)'),
        ul([
          [code('manifest.json'), ' na raiz (obrigatório): o nome, dois IDs únicos, um número de versão que sobe a cada atualização e a versão mais antiga do jogo compatível (aqui, por padrão, ', code(`"min_engine_version": ${MIN_ENGINE}`), ').'],
          [code('pack_icon.png'), ' (opcional): o ícone do pack.'],
          ['Texturas em ', code('textures/'), ', por exemplo ', code('textures/blocks/stone.png'), '. Algumas texturas vanilla são arquivos ', code('.tga'), '; mantenha o mesmo nome e a mesma extensão do original.'],
        ]),
        callout('tip', 'Os nomes de arquivo importam', 'O Minecraft só substitui uma textura quando o seu arquivo tem exatamente o mesmo caminho do original. No Java, os caminhos precisam estar em minúsculas (a-z, 0-9, _ - . e /). O Texture Pack Maker cuida disso para você.'),
        h3('Estrutura de pastas lado a lado'),
        pre(
          [
            'Java: MyPack.zip',
            '├── pack.mcmeta',
            '├── pack.png',
            '└── assets/minecraft/textures/',
            '    ├── block/stone.png',
            '    └── item/diamond_sword.png',
            '',
            'Bedrock: MyPack.mcpack',
            '├── manifest.json',
            '├── pack_icon.png',
            '└── textures/',
            '    ├── blocks/stone.png',
            '    └── items/diamond_sword.png',
          ].join('\n'),
        ),
        table(
          ['', 'pack.mcmeta do Java', 'manifest.json do Bedrock'],
          [
            ['Obrigatório', 'Sim, na raiz do zip', 'Sim, na raiz do .mcpack'],
            ['Identifica o pack por', 'Nome do arquivo ou da pasta', 'Dois IDs únicos (UUIDs)'],
            ['Versão do jogo', `Números de pack format (a ${LATEST} usa ${F(LATEST)})`, [code('min_engine_version'), ', a versão mais antiga compatível']],
            ['Atualizações', 'Substituir o arquivo', 'Aumentar o número da versão e manter os IDs'],
          ],
        ),
      ],
    },
    {
      id: 'mcmeta',
      title: 'O arquivo pack.mcmeta (Java)',
      body: [
        p('Este arquivo diz ao Minecraft para quais versões o pack serve. O número do formato muda em quase toda atualização: o Java ', LATEST, ' usa o formato de pacote de recursos ', strong(F(LATEST)), '. Um pack feito só para a ', LATEST, ' fica assim:'),
        pre(mcmetaFor(LATEST, `Meu pack para Minecraft ${LATEST}`)),
        p(
          'Desde a 1.21.9, os packs indicam uma faixa com ',
          code('min_format'),
          ' e ',
          code('max_format'),
          '. Um pack que também precisa carregar em versões mais antigas precisa ainda de ',
          code('pack_format'),
          ' e ',
          code('supported_formats'),
          '. O Texture Pack Maker escreve a combinação certa para a versão e a faixa que você escolher. Veja ',
          link('/guides/minecraft-pack-format-versions', 'o pack format de cada versão'),
          '.',
        ),
        callout('warn', 'Faltou a descrição?', `No Java ${LATEST}, um pack cujo pack.mcmeta não tem descrição, ou não é um JSON válido, nem aparece na lista. Deixe o pack.mcmeta na raiz do zip, não dentro de uma pasta.`),
      ],
    },
    {
      id: 'by-hand',
      title: 'Fazer um texture pack à mão',
      body: [
        p('Você também pode montar um pack sozinho com qualquer editor de imagens. Demora mais, mas mostra como um pack funciona:'),
        h3('Java Edition'),
        steps([
          ['Ache as texturas originais: copie ', code('versions/<version>/<version>.jar'), ' da sua pasta ', code('.minecraft'), ', renomeie a cópia para ', code('.zip'), ' e abra. As imagens ficam em ', code('assets/minecraft/textures'), '.'],
          ['Crie uma pasta nova para o seu pack com um ', code('pack.mcmeta'), ' (veja abaixo) e as mesmas pastas ', code('assets/minecraft/textures/…'), ' das originais.'],
          'Copie só os PNGs que você quer mudar e edite, mantendo os nomes e os tamanhos na mesma proporção (16×16, 32×32 e assim por diante).',
          ['Compacte o ', strong('conteúdo'), ' da pasta, não a pasta em si, para o ', code('pack.mcmeta'), ' ficar na raiz do zip. Coloque o zip em ', code('resourcepacks'), '.'],
        ]),
        h3('Bedrock Edition'),
        steps([
          ['Pegue as texturas originais no repositório ', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), ' da Mojang (', code('resource_pack/textures'), ').'],
          ['Crie uma pasta com um ', code('manifest.json'), ' com dois IDs únicos novos (UUIDs) e as suas imagens editadas em ', code('textures/'), '.'],
          ['Compacte o conteúdo da pasta, renomeie o arquivo de ', code('.zip'), ' para ', code('.mcpack'), ' e abra para importar.'],
        ]),
        callout('tip', 'Pule o trabalho chato', 'O Texture Pack Maker cuida da cópia, dos nomes de pasta, do pack.mcmeta, dos UUIDs e da compactação, e mostra cada textura no modelo 3D enquanto você pinta.'),
      ],
    },
    {
      id: 'tips',
      title: 'Dicas para um bom pack',
      body: [
        ul([
          'Comece pequeno: repinte alguns blocos que você vê o tempo todo (grama, terra, pedra, madeira) e teste no jogo antes de fazer tudo.',
          'Use a mesma resolução no pack inteiro. Misturar texturas 16× e 64× fica desigual.',
          'Use a prévia 3D do bloco para ver como as laterais se encaixam.',
          'Use a prévia em mosaico nos blocos que se repetem, para as emendas não aparecerem.',
          'Coloque seu pack no topo da lista de selecionados. Packs mais acima vencem.',
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'both',
      q: 'Um texture pack funciona no Java e no Bedrock?',
      a: [p('Não. As duas edições usam arquivos e pastas diferentes. Faça o pack para uma edição e depois passe para a outra com o ', link('/texture-pack-converter', 'conversor de texture pack'), '. ', link('/guides/java-vs-bedrock-packs', 'Packs do Java vs Bedrock'), '.')],
    },
    {
      id: 'free',
      q: 'Preciso instalar algum programa?',
      a: [p('Não. O Texture Pack Maker roda no navegador do computador, celular ou tablet, e nada é enviado.')],
    },
    {
      id: 'edit',
      q: 'Posso mudar um texture pack que já existe?',
      a: [p('Sim. No Texture Pack Maker escolha ', strong('Open a pack'), ' e selecione um ', code('.zip'), ' ou ', code('.mcpack'), '. Você pode continuar editando e exportar de novo.'), figure(SHOTS.openPack)],
    },
    {
      id: 'code',
      q: 'Preciso saber programar para fazer um texture pack?',
      a: [p('Não. Um texture pack são imagens e um pequeno arquivo de descrição, e o Texture Pack Maker escreve esse arquivo para você. Você só precisa pintar.')],
    },
    {
      id: 'older',
      q: 'Como faço um texture pack para uma versão antiga, como a 1.21.11 ou a 1.8.9?',
      a: [p('Escolha essa versão ao criar o pack. A ferramenta carrega as texturas e os nomes de pasta dessa versão e escreve o pack format dela. ', link('/guides/minecraft-pack-format-versions', 'Pack format de cada versão'), '.')],
    },
    {
      id: 'originals',
      q: 'Onde acho as texturas originais do Minecraft?',
      a: [p('Dentro do arquivo ', code('.jar'), ' do jogo no Java (', code('assets/minecraft/textures'), ') e no repositório bedrock-samples da Mojang no Bedrock. O Texture Pack Maker baixa as texturas da Mojang para você quando você escolhe uma versão.')],
    },
    {
      id: 'mobile',
      q: 'Posso fazer um texture pack no celular?',
      a: [p('Sim. O Texture Pack Maker funciona no navegador no Android, iPhone e iPad, além de computadores e Chromebooks. No Bedrock, abra o ', code('.mcpack'), ' exportado e o Minecraft importa.')],
    },
    {
      id: 'time',
      q: 'Quanto tempo leva para fazer um texture pack?',
      a: [p('Alguns minutos para um pack pequeno que muda poucos blocos, ou para um efeito no pack inteiro como Dark Mode. Um pack completo pintado à mão, com centenas de texturas, pode levar semanas; você pode exportar e testar a qualquer momento.')],
    },
    {
      id: 'hd',
      q: 'Qual resolução meu texture pack deve ter?',
      a: [p('16× é igual ao jogo vanilla e é o mais rápido de pintar. 32× e 64× deixam espaço para mais detalhes; 128× ou mais são para packs realistas e pedem um computador mais forte. Use uma só resolução no pack inteiro.')],
    },
  ],
  ctaLabel: 'Abrir o Texture Pack Maker',
};

const notWorking: GuideText = {
  image: SHOTS.packSettings,
  intro: [
    p(
      'A maioria dos problemas com texture packs vem de três coisas: o arquivo de descrição do pack (',
      code('pack.mcmeta'),
      ' no Java, ',
      code('manifest.json'),
      ' no Bedrock) está faltando ou no lugar errado, o pack foi feito para outra versão do jogo, ou uma textura não está exatamente no caminho que o Minecraft procura. Ache abaixo o que você está vendo e aplique a solução.',
    ),
  ],
  quick: {
    title: 'Confira isto primeiro',
    items: [
      ['Java: ao abrir o zip aparecem direto o ', code('pack.mcmeta'), ' e a pasta ', code('assets'), ', não outra pasta.'],
      'O pack foi feito para a versão que você joga (ou a faixa de compatibilidade dele inclui essa versão).',
      'O pack está na lista de selecionados (Java) ou de ativos (Bedrock), acima de packs que mudam as mesmas texturas.',
      'Os nomes de arquivo e as pastas são exatamente iguais aos originais, em minúsculas no Java.',
    ],
  },
  sections: [
    {
      id: 'not-listed',
      title: 'O pack não aparece na lista',
      body: [
        p('O Java só mostra um pack quando encontra um ', code('pack.mcmeta'), ' válido na raiz do zip ou da pasta.'),
        ul([
          [strong('Pasta dentro de pasta: '), 'compactar a própria pasta do pack coloca tudo um nível abaixo (', code('MyPack.zip/MyPack/pack.mcmeta'), '). Compacte o conteúdo da pasta.'],
          [strong('pack.mcmeta quebrado: '), `uma vírgula ou aspa faltando deixa o JSON inválido. No Java ${LATEST}, um pack sem descrição também não aparece.`],
          [strong('Pasta errada: '), 'o zip tem que estar em ', code('resourcepacks'), ', não em ', code('shaderpacks'), ' nem em ', code('mods'), '. Use ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ' para abrir a pasta certa.'],
          [strong('Download incompleto ou bloqueado: '), 'às vezes o navegador salva um arquivo baixado pela metade como ', code('.crdownload'), ' ou ', code('.part'), '. Baixe o pack de novo.'],
        ]),
      ],
    },
    {
      id: 'version',
      title: '“Feito para uma versão mais antiga / mais recente do Minecraft”',
      body: [
        p(
          'O Java compara o pack format do ',
          code('pack.mcmeta'),
          ' com o dele (a ',
          LATEST,
          ' usa ',
          strong(F(LATEST)),
          '). Um pack que só muda texturas costuma funcionar mesmo assim se você clicar em ',
          strong('Sim'),
          ', mas texturas que faltam ou foram renomeadas podem ficar erradas. A solução certa é exportar o pack de novo para a sua versão, ou dar a ele uma faixa de compatibilidade que inclua essa versão. Para um pack antigo que não foi você que fez, o ',
          link('/texture-pack-converter', 'conversor de texture pack'),
          ' renomeia as texturas para a sua versão e escreve um pack.mcmeta novo.',
        ),
        p(
          'A partir da 1.21.9, um pack que só tem um número ',
          code('pack_format'),
          ', ou campos que quebram as regras novas, pode aparecer como ',
          el('em', null, 'corrompido ou incompatível'),
          '. Packs novos usam ',
          code('min_format'),
          ' e ',
          code('max_format'),
          '. ',
          link('/guides/minecraft-pack-format-versions', 'O pack format de cada versão'),
          '.',
        ),
        figure(SHOTS.packSettings),
      ],
    },
    {
      id: 'purple',
      title: 'Blocos roxos e pretos',
      body: [
        p(
          'O xadrez roxo e preto é a “textura faltando”. Um modelo pede uma imagem que não existe naquele caminho: o arquivo foi renomeado, está na pasta errada ou o pack usa nomes de pasta de outra versão. Por exemplo, versões anteriores à 1.13 usam ',
          code('textures/blocks'),
          ' e ',
          code('textures/items'),
          ', enquanto a 1.13 e as mais novas usam ',
          code('textures/block'),
          ' e ',
          code('textures/item'),
          '.',
        ),
        p('Se você adicionou modelos próprios, confira cada caminho de textura dentro deles. Packs feitos no Texture Pack Maker usam os caminhos exatos da versão escolhida.'),
      ],
    },
    {
      id: 'some-textures',
      title: 'Só algumas texturas mudaram',
      body: [
        ul([
          [strong('Nome ou caminho com uma letra diferente: '), 'o arquivo precisa ter exatamente o mesmo nome e a mesma pasta do original. O Java ignora caminhos com letras maiúsculas ou espaços.'],
          [strong('Outro pack vence: '), 'packs mais acima na lista substituem as mesmas texturas. Mova o seu para o topo, ou junte os packs em um com ', link('/merge-texture-packs', 'Juntar texture packs'), ', na ordem que você quiser.'],
          [strong('Arquivo errado para aquele bloco: '), 'alguns blocos usam várias imagens (a frente, a lateral e o topo da fornalha; o topo, a lateral e a camada lateral do bloco de grama). Edite todas, ou use a prévia 3D para ver qual imagem vai onde.'],
          [strong('Tipo de imagem errado no Bedrock: '), 'algumas texturas vanilla do Bedrock são arquivos ', code('.tga'), '. Mantenha o mesmo nome e tipo de arquivo do original para o seu substituir.'],
        ]),
      ],
    },
    {
      id: 'grey',
      title: 'Grama e folhas ficam cinza',
      body: [
        p(
          'No arquivo de imagem isso é normal. Grama, folhas, trepadeiras, água e algumas outras texturas são guardadas em cinza e coloridas pelo jogo conforme o bioma, então pinte em tons de cinza-claro e confira no jogo. Se você pintar de verde, elas vão ficar muito mais escuras ou com cores estranhas depois que o jogo aplicar a cor.',
        ),
      ],
    },
    {
      id: 'animation',
      title: 'Uma textura animada aparece como uma faixa comprida',
      body: [
        p(
          'Texturas animadas são uma imagem alta com os quadros empilhados um sobre o outro, mais um arquivo ',
          code('.png.mcmeta'),
          ' com o mesmo nome (por exemplo ',
          code('sea_lantern.png.mcmeta'),
          '). Sem esse arquivo, o Java espreme a faixa inteira em um bloco. O Bedrock lista as texturas animadas em ',
          code('textures/flipbook_textures.json'),
          '. O Texture Pack Maker escreve esses arquivos quando você edita quadros de animação.',
        ),
      ],
    },
    {
      id: 'all-off',
      title: 'Todos os meus pacotes de recursos foram desativados (Java)',
      body: [
        p(
          'Quando um pacote de recursos tem um shader que não compila, o Java desativa todos os packs e volta ao padrão. Isso acontece com shader packs vanilla feitos para outra versão, porque a Mojang muda esses arquivos de shader com frequência. Remova o pack ou exporte de novo para a sua versão exata; cada shader que o ',
          link('/shaders', 'Shader Maker'),
          ' escreve é verificado na compilação antes.',
        ),
      ],
    },
    {
      id: 'bedrock-import',
      title: 'Bedrock: a importação falhou',
      body: [
        ul([
          [strong('Falha na importação: '), 'o ', code('manifest.json'), ' está faltando, é inválido ou não está na raiz do arquivo. Exporte o pack de novo e abra o arquivo novo.'],
          [strong('Pack duplicado: '), 'já existe um pack instalado com os mesmos IDs e o mesmo número de versão. Aumente a versão (o Texture Pack Maker faz isso a cada exportação) ou apague a cópia antiga em ', uiPath('Opções', 'Armazenamento'), '.'],
          [strong('Tipo de arquivo errado: '), 'um ', code('.zip'), ' do Java renomeado para ', code('.mcpack'), ' não funciona; o Bedrock precisa dos próprios arquivos e pastas. Converta com o ', link('/texture-pack-converter', 'conversor de texture pack'), '.'],
          [strong('Console: '), 'Xbox, PlayStation e Switch não importam arquivos. Entre em um mundo, Realm ou servidor que tenha o pack.'],
        ]),
      ],
    },
    {
      id: 'bedrock-nothing',
      title: 'Bedrock: importou, mas nada muda',
      body: [
        ul([
          ['Ative: ', uiPath('Opções', 'Recursos globais', 'Meus Pacotes'), ', selecione o pack e toque em ', strong('Ativar'), '. Para um só mundo, use ', uiPath('Editar Mundo', 'Pacotes de recursos'), '.'],
          'Coloque acima de outros packs ativos que mudam as mesmas texturas.',
          ['Se o pack precisa de um jogo mais novo que o seu, a ', code('min_engine_version'), ' dele está alta demais: atualize o Minecraft ou exporte com um mínimo mais baixo.'],
          'Packs feitos para os gráficos clássicos podem ficar diferentes, ou ser desligados, com os Visuais Vibrantes. Tente trocar o modo de gráfico.',
        ]),
      ],
    },
    {
      id: 'shaders',
      title: 'Um shader pack não aparece',
      body: [
        ul([
          ['Shader packs de Iris e OptiFine vão na pasta ', code('shaderpacks'), ', aberta em ', uiPath(OPTIONS, VIDEO, IRIS_SHADERS), ', não em ', code('resourcepacks'), '.'],
          ['O Iris precisa de OpenGL. No Java 26.2 e mais novos, coloque ', strong('API gráfica'), ' em ', strong('Padrão'), ' ou ', strong('Preferir OpenGL'), ' se o Iris disser que não roda com Vulkan.'],
          ['Shader packs vanilla (sem mods) são pacotes de recursos e só funcionam na versão para a qual foram feitos. ', link('/guides/make-shaders-without-mods', 'Shaders sem mods'), '.'],
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'why-red',
      q: 'Por que meu texture pack aparece em vermelho na lista de pacotes de recursos?',
      a: [p('Vermelho quer dizer que o formato do pack não bate com a sua versão do jogo. Pode funcionar mesmo assim; exporte de novo para a sua versão para ter certeza.')],
    },
    {
      id: 'reload',
      q: 'Preciso reiniciar o Minecraft depois de mudar um pack?',
      a: [p('Não. No Java aperte F3 + T para recarregar os pacotes de recursos, ou desative e ative o pack. No Bedrock, saia do mundo e entre de novo.')],
    },
    {
      id: 'server',
      q: 'Por que um servidor muda minhas texturas?',
      a: [p('Servidores podem mandar o próprio pacote de recursos, que fica acima do seu. Você pode recusar nas configurações do servidor na tela de multijogador, mas alguns servidores exigem.')],
    },
  ],
  ctaLabel: 'Abrir o Texture Pack Maker',
};

const install: GuideText = {
  intro: [
    p(
      'No ',
      strong('Java'),
      ', coloque o ',
      code('.zip'),
      ' do pack na pasta ',
      code('resourcepacks'),
      ' e ative em Opções › Pacotes de recursos. No ',
      strong('Bedrock'),
      ', abra o arquivo ',
      code('.mcpack'),
      ' e o Minecraft importa; depois ative em Opções › Recursos globais. Shader packs para o Java precisam de Iris ou OptiFine.',
    ),
  ],
  quick: {
    title: 'Resposta rápida',
    items: [
      ['Java: ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', coloque o ', code('.zip'), ' lá, mova o pack para Selecionados e clique em Concluído.'],
      ['Bedrock: abra o arquivo ', code('.mcpack'), ' e ative em ', uiPath('Opções', 'Recursos globais'), '.'],
      ['Shaders (Java): instale Iris ou OptiFine e coloque o zip do shader na pasta ', code('shaderpacks'), '.'],
    ],
  },
  howto: { name: 'Como instalar um pacote de recursos no Minecraft Java Edition', steps: INSTALL_JAVA_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Instalar um pacote de recursos no Java',
      body: [steps(INSTALL_JAVA_STEPS), h3('Onde fica a pasta resourcepacks?'), folderTable('resourcepacks', FOLDER)],
    },
    {
      id: 'order',
      title: 'Usar mais de um pack',
      body: [
        p(
          'Você pode ativar quantos packs quiser. Quando dois packs mudam a mesma textura, vence o que está mais acima na lista de ',
          strong('Selecionados'),
          ' (Java) ou de ativos (Bedrock), e tudo o que ele não muda passa para os packs de baixo. Uma montagem comum é um pack pequeno com seus ajustes no topo e um pack completo embaixo.',
        ),
        p('Para transformar essa pilha em um só pack, para compartilhar ou para um servidor que manda um único pacote de recursos, use ', link('/merge-texture-packs', 'Juntar texture packs'), ': ele segue a mesma regra, então o pack do topo da lista vence.'),
        p('Launchers de terceiros como Lunar Client e Badlion Client usam por padrão a mesma pasta ', code('resourcepacks'), ' dentro de ', code('.minecraft'), ' e têm o próprio menu de pacotes de recursos para ativar os packs.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Instalar um .mcpack no Bedrock',
      body: [
        tabbed(
          'install-bedrock',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Clique duas vezes no ', code('.mcpack'), '. O Minecraft abre e mostra ', el('em', null, 'Importação iniciada...'), ' e depois que a importação deu certo.'],
                  ['Vá em ', uiPath('Opções', 'Recursos globais', 'Meus Pacotes'), ', selecione o pack e toque em ', strong('Ativar'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android e iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Baixe o ', code('.mcpack'), ' no celular ou tablet.'],
                  [strong('Android: '), 'abra pelos Downloads ou pelo app de arquivos e escolha o Minecraft. ', strong('iPhone / iPad: '), 'toque nele no app Arquivos e depois em ', uiPath('Compartilhar', 'Minecraft'), '.'],
                  ['Ative em ', uiPath('Opções', 'Recursos globais'), '.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation e Switch não importam arquivos. Adicione o pack a um mundo no PC ou no celular e entre nesse mundo, ou jogue em um Realm ou servidor que tenha o pack.')],
            },
          ],
          UI_PT_BR.platform,
        ),
        callout('tip', 'Só um mundo?', 'Abra ', uiPath('Editar Mundo', 'Pacotes de recursos'), ' e ative o pack lá em vez de em Recursos globais.'),
      ],
    },
    {
      id: 'shaders',
      title: 'Instalar um shader pack',
      body: [
        ul([
          [strong('Iris (Java):'), ' instale o Iris com o instalador de ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ', jogue uma vez com o perfil do Iris, depois abra ', uiPath(OPTIONS, VIDEO, IRIS_SHADERS), ', clique em ', strong('Abrir pasta de pacotes'), ' e coloque o zip lá.'],
          [strong('OptiFine (Java):'), ' ', uiPath(OPTIONS, VIDEO, 'Shaders...'), ', depois ', strong('Pasta de shaders'), '.'],
          [strong('Shaders vanilla (Java, sem mods):'), ' são pacotes de recursos. Instale na pasta ', code('resourcepacks'), ' como qualquer outro pack.'],
          [strong('Visuais Vibrantes (Bedrock):'), ' abra o ', code('.mcpack'), ', ative e depois coloque ', uiPath('Opções', 'Vídeo', 'Modos de Gráfico'), ' em Visuais Vibrantes.'],
        ]),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    {
      id: 'skins',
      title: 'Instalar uma skin',
      body: [
        ul([
          [strong('Java:'), ' Minecraft Launcher › Aparências › Nova aparência, escolha Clássico ou Fino, procure o PNG e clique em Salvar e usar. Ou envie no seu perfil em minecraft.net.'],
          [strong('Bedrock:'), ' abra um pacote de skins ', code('.mcpack'), ' e escolha a skin em Vestiário › Aparências Clássicas, ou importe lá um único PNG.'],
        ]),
        p('Mais detalhes em ', link('/guides/make-a-skin', 'Como fazer sua própria skin de Minecraft'), '.'),
      ],
    },
    {
      id: 'troubleshooting',
      title: 'O pack não funciona?',
      body: [
        p('Os problemas mais comuns estão abaixo. ', link('/guides/texture-pack-not-working', 'Todas as soluções, com explicações'), '.'),
        table(
          ['O que você vê', 'Por quê', 'Solução'],
          [
            ['“Feito para uma versão mais antiga / mais recente do Minecraft”', 'O pack format do pack.mcmeta não é o do seu jogo.', 'Exporte de novo para a sua versão ou aumente a faixa de compatibilidade. Packs só de texturas costumam funcionar se você clicar em Sim.'],
            ['“Corrompido ou incompatível” (Java 1.21.9+)', 'O pack.mcmeta só tem pack_format, ou os campos quebram as regras.', 'Exporte de novo pelo Texture Pack Maker, que escreve min_format e max_format.'],
            ['O pack nem aparece na lista', 'O pack.mcmeta está faltando, não está na raiz do zip, não é um JSON válido ou não tem descrição.', 'Confira se ao abrir o zip aparecem direto o pack.mcmeta e a pasta assets, e não outra pasta.'],
            ['O Bedrock diz que a importação falhou', 'O manifest.json está faltando, não está na raiz do arquivo ou é inválido.', 'Exporte de novo como .mcpack e abra o arquivo novo.'],
            ['O pack do Bedrock não muda nada', 'Outro pack acima dele substitui as mesmas texturas.', 'Mova o seu pack para o topo da lista de ativos.'],
          ],
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'unzip',
      q: 'Devo descompactar um pacote de recursos?',
      a: [p('Não. O Java carrega packs compactados direto. Uma pasta descompactada também funciona se o pack.mcmeta estiver logo dentro dela, mas manter o zip é mais simples.')],
    },
    {
      id: 'order',
      q: 'Qual pack vence quando dois mudam a mesma textura?',
      a: [p('O que está mais acima na lista de selecionados (Java) ou de ativos (Bedrock). ', link('/merge-texture-packs', 'Juntar texture packs'), ' usa a mesma ordem para juntar vários packs em um.')],
    },
    {
      id: 'realms',
      q: 'Jogadores de console podem usar packs personalizados?',
      a: [p('Não importando arquivos. Eles podem entrar em um mundo, Realm ou servidor que tenha o pack.')],
    },
  ],
  ctaLabel: 'Guia de instalação completo para cada plataforma',
};

const packFormats: GuideText = {
  intro: [
    p(
      'Todo pacote de recursos do Java Edition informa um ',
      strong('pack format'),
      ' no arquivo ',
      code('pack.mcmeta'),
      ', e o Minecraft compara esse número com o dele para decidir se o pack serve. ',
      strong(`O Minecraft Java ${LATEST} usa o formato de pacote de recursos ${F(LATEST)}.`),
      ' Os pacotes de recursos começaram na 1.6.1; as versões mais antigas usavam texture packs, que funcionam de outro jeito.',
    ),
  ],
  quick: {
    title: `Resposta rápida: Minecraft ${LATEST}`,
    items: [
      ['Formato de pacote de recursos: ', strong(F(LATEST)), '.'],
      ['No ', code('pack.mcmeta'), ' escreva ', code(`"min_format": ${minFormat(LATEST)}`), ' e ', code(`"max_format": ${maxFormat(LATEST)}`), ' (desde a 1.21.9 o formato é dividido em um número principal e um secundário).'],
      ['Um pack que também serve para versões mais antigas precisa ainda de ', code('pack_format'), ' e ', code('supported_formats'), '. A tabela abaixo lista todas as versões.'],
    ],
  },
  sections: [
    {
      id: 'table',
      title: 'Formato de pacote de recursos de cada versão do Java',
      body: [
        p('Todas as versões completas de 1.6.1 a ', LATEST, '. Snapshots, pre-releases e release candidates têm números próprios.'),
        table(
          ['Pack format', 'Versões do Minecraft Java'],
          formatGroups()
            .reverse()
            .map((g) => [g.format, g.versions.join(', ')]),
          'guide-table formats-table',
        ),
        p(
          'Desde o ciclo da 1.21.9, um formato também pode ter um número secundário: ',
          F(LATEST),
          ` quer dizer principal ${formatParts(LATEST).major}, secundário ${formatParts(LATEST).minor}. A Mojang aumenta o número secundário em adições que não quebram packs mais antigos. No momento em que este guia foi escrito, a primeira snapshot da ${NEXT_SNAPSHOT.version} usa ${NEXT_SNAPSHOT.format}.`,
        ),
      ],
    },
    {
      id: 'eras',
      title: 'Como o pack.mcmeta mudou',
      body: [
        table(
          ['Versões do jogo', 'Campos que o jogo lê'],
          [
            ['1.6.1 – 1.8.7', [code('pack_format'), ' e ', code('description'), '. Não há nenhuma checagem de versão, então qualquer número carrega.']],
            ['1.8.8 – 1.20.1', ['Só ', code('pack_format'), '. O pack é considerado compatível quando o número é igual ao do jogo; senão o Minecraft avisa, mas deixa usar.']],
            ['1.20.2 – 1.21.8', [code('pack_format'), ' (obrigatório) mais uma faixa opcional ', code('supported_formats'), ' como ', code('[15, 64]'), '.']],
            [`1.21.9 – ${LATEST}`, [code('min_format'), ' e ', code('max_format'), ' (obrigatórios juntos). Um pack cuja faixa volta até o formato 64 ou menos também precisa de ', code('pack_format'), ' e ', code('supported_formats'), '; um pack só para 1.21.9+ não pode usar ', code('supported_formats'), '.']],
          ],
        ),
      ],
    },
    {
      id: 'examples',
      title: 'Exemplos',
      body: [
        h3(`Só Java ${LATEST}`),
        pre(mcmetaFor(LATEST, `Meu pack para Minecraft ${LATEST}`)),
        p('Um número sozinho em ', code('max_format'), ` quer dizer “qualquer versão secundária”, então ${maxFormat(LATEST)} cobre ${maxFormat(LATEST)}.0 e ${F(LATEST)}. Escrever `, code(`[${maxFormat(LATEST)}, 0]`), ` ali deixaria o pack antigo demais para a ${LATEST}.`),
        h3(`Da 1.20.1 à ${LATEST}`),
        pre(mcmetaRange('1.20.1', LATEST, `Meu pack para Minecraft 1.20.1 - ${LATEST}`)),
        p('A 1.20.1 lê ', code('pack_format'), ', da 1.20.2 à 1.21.8 leem ', code('supported_formats'), ' e a 1.21.9 e as mais novas leem ', code('min_format'), ' e ', code('max_format'), '.'),
        h3('Só 1.20.1 (e 1.20)'),
        pre(mcmetaLegacy('1.20.1', 'Meu pack para Minecraft 1.20.1')),
        callout('tip', 'Deixe a ferramenta fazer isso', 'No Texture Pack Maker, escolha sua versão e, se quiser, uma faixa de compatibilidade na aba Pack. A exportação recebe exatamente os campos que cada versão precisa.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'E o Bedrock?',
      body: [
        p(
          'Packs do Bedrock não têm número de pack format. O ',
          code('manifest.json'),
          ' deles usa ',
          code('"format_version": 2'),
          ' e uma ',
          code('min_engine_version'),
          ' como ',
          code(MIN_ENGINE),
          '. Os números de versão do Bedrock agora seguem o ano (a 26.0 saiu em fevereiro de 2026), mas os manifestos mantêm o estilo antigo, então a 26.50 é escrita ',
          code('[1, 26, 50]'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'latest',
      q: `Qual é o formato de pacote de recursos do Minecraft ${LATEST}?`,
      a: [p(`${F(LATEST)}. Escreva "min_format": ${minFormat(LATEST)} e "max_format": ${maxFormat(LATEST)} no pack.mcmeta de um pack só para a ${LATEST}.`)],
    },
    {
      id: '1211',
      q: 'Qual é o pack format da 1.21.1 e da 1.20.1?',
      a: [p(`A 1.21 e a 1.21.1 usam ${F('1.21.1')}; a 1.20 e a 1.20.1 usam ${F('1.20.1')}. A 1.8.9 e as versões 1.x mais antigas desde a 1.6.1 usam ${F('1.8.9')}.`)],
    },
    {
      id: 'broken',
      q: 'Por que meu pack diz “Corrompido ou incompatível”?',
      a: [p('Na 1.21.9 e nas mais novas, um pack que só tem um pack_format alto (acima de 64) e não tem min_format / max_format não passa na checagem. Ainda dá para ativar, mas é melhor adicionar os dois campos.')],
    },
  ],
  ctaLabel: 'Criar um pack com o formato certo',
};

const makeASkin: GuideText = {
  image: SHOTS.skin2d,
  intro: [
    p(
      'Uma skin de Minecraft é uma imagem PNG de 64×64 pixels que envolve o modelo do jogador. Dá para criar uma no navegador: pinte no modelo, confira em um modelo 3D e depois envie no Minecraft Launcher (Java) ou importe como pacote de skins (Bedrock).',
    ),
  ],
  quick: {
    title: 'Resumindo',
    items: ['Abra o Skin Maker e escolha um modelo ou uma skin inicial.', 'Pinte olhando a prévia 3D.', 'Exporte um PNG para o Java ou um .mcpack para o Bedrock e envie.'],
  },
  howto: { name: 'Como fazer uma skin de Minecraft online', steps: SKIN_STEPS },
  sections: [
    { id: 'steps', title: 'Passo a passo', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
    {
      id: 'template',
      title: 'Como funciona o modelo de skin',
      body: [
        ul([
          ['A imagem tem ', strong('64×64'), ' pixels. O Java 1.7.10 e anteriores usam o layout antigo de ', strong('64×32'), ', sem braço e perna esquerdos separados; o Bedrock também aceita skins HD de ', strong('128×128'), '.'],
          ['São duas camadas. A ', strong('camada base'), ' é o corpo; a ', strong('camada externa'), ' (chapéu, jaqueta, mangas e pernas da calça) fica logo acima e pode ser transparente.'],
          ['Os braços ', strong('clássicos'), ' (Steve) têm 4 pixels de largura e os ', strong('finos'), ' (Alex) têm 3. Envie a skin com o mesmo modelo em que você pintou.'],
          'As partes do modelo que não são usadas devem ficar totalmente transparentes.',
        ]),
      ],
    },
    {
      id: 'java',
      title: 'Usar no Java',
      body: [
        steps([
          ['Abra o Minecraft Launcher e vá em ', uiPath('Minecraft: Java Edition', 'Aparências'), '.'],
          ['Clique em ', strong('Nova aparência'), ', dê um nome e escolha ', strong('Clássico'), ' ou ', strong('Fino'), '.'],
          ['Clique em ', strong('Procurar'), ', escolha seu PNG e depois ', strong('Salvar e usar'), '.'],
        ]),
        p('Você também pode enviar no seu perfil em ', ext('https://www.minecraft.net/', 'minecraft.net'), '.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Fazer seu próprio pacote de skins do Bedrock',
      body: [
        p(
          'Um pacote de skins é um ',
          code('.mcpack'),
          ' com uma ou mais skins. O Skin Maker monta para você; dentro dele há um ',
          code('manifest.json'),
          ' (tipo de módulo ',
          code('skin_pack'),
          '), um ',
          code('skins.json'),
          ' que lista cada skin com o modelo clássico (',
          code('geometry.humanoid.custom'),
          ') ou fino (',
          code('geometry.humanoid.customSlim'),
          ') e ',
          code('"type": "free"'),
          ', os PNGs das skins na raiz e os nomes em ',
          code('texts/en_US.lang'),
          '.',
        ),
        steps([
          ['Pinte cada skin como um projeto separado. Skins clássicas e finas podem dividir o mesmo pacote.'],
          ['Escolha ', strong('Export'), ' › ', strong('Bedrock skin pack'), ', dê um nome ao pacote e marque as outras skins que vão junto.'],
          'Abra o .mcpack (clique duas vezes no Windows, “Abrir com o Minecraft” no Android, Compartilhar › Minecraft no iPhone e iPad).',
          ['No Minecraft vá em ', uiPath('Vestiário', 'Aparências Clássicas'), ', ache seu pacote, escolha a skin e toque em ', strong('Equipar'), '.'],
        ]),
        figure(SHOTS.skinPack),
        callout('warn', 'Bom saber', 'Consoles não importam arquivos de skin. Quem ativa “Apenas Permitir Aparências Confiáveis” vê skins personalizadas como skins padrão. Pacotes de skins importados não aceitam modelos próprios, só clássico e fino.'),
        p('Instalar, atualizar e os arquivos que vão dentro, passo a passo: ', link('/guides/make-a-bedrock-skin-pack', 'Como fazer um pacote de skins do Minecraft Bedrock'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'size', q: 'Qual deve ser o tamanho de uma skin de Minecraft?', a: [p('64×64 pixels, salva como PNG. Use 64×32 só para o Java 1.7.10 e anteriores.')] },
    { id: 'username', q: 'Posso começar com a skin de outra pessoa?', a: [p('Sim. O Skin Maker carrega a skin atual de qualquer jogador do Java pelo nome de usuário, para você remixar. Respeite o trabalho dos outros.')] },
    { id: 'phone', q: 'Posso fazer uma skin no celular?', a: [p('Sim. O editor funciona com toque, inclusive o zoom com dois dedos.')] },
    {
      id: 'slim-pack',
      q: 'Um pacote de skins pode misturar skins clássicas e finas?',
      a: [p('Sim. Cada skin do pacote tem o próprio modelo, então um pacote de skins próprio pode ter skins clássicas (braços de 4 pixels) e finas (braços de 3 pixels) lado a lado.')],
    },
    {
      id: 'update-pack',
      q: 'Como atualizo um pacote de skins que já importei?',
      a: [p('Exporte de novo a partir do mesmo projeto e abra o .mcpack novo. O pacote mantém os IDs e recebe um número de versão maior, então o Minecraft substitui o antigo em vez de criar uma cópia.')],
    },
  ],
  ctaLabel: 'Abrir o Skin Maker',
};

const shadersWithoutMods: GuideText = {
  image: SHOTS.shaderVanilla,
  intro: [
    p(
      strong('Sim, com limites.'),
      ` Você não precisa de OptiFine, Iris nem de nenhum outro mod para efeitos de shader básicos. No Java 1.17 e mais novos, um pacote de recursos comum pode substituir alguns dos arquivos de shader do próprio Minecraft, então você ganha correção de cor, vinheta, mudanças na neblina e, na ${LATEST}, bloom sem instalar nada. No Bedrock não é permitido código de shader próprio, mas um pacote de Visuais Vibrantes ajusta a iluminação, o céu, a neblina e a água do jogo. Sombras e reflexos de verdade no Java ainda precisam de Iris ou OptiFine.`,
    ),
  ],
  howto: { name: 'Como fazer um shader pack para Minecraft Java sem mods', steps: VANILLA_SHADER_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java: shaders em um pacote de recursos',
      body: [
        p('Desde a 1.17, o Minecraft desenha o mundo com arquivos de shader que um pacote de recursos pode substituir. O que um shader pack vanilla consegue fazer depende da versão:'),
        table(
          ['Efeito', 'Funciona em'],
          [
            ['Correção de cor (brilho, contraste, saturação, temperatura, preto e branco, sépia)', 'Java 1.17 e mais novos'],
            ['Vinheta', 'Java 1.17 e mais novos'],
            ['Distância e cor da neblina', 'Java 1.17 e mais novos'],
            ['Bloom (brilho em tela cheia)', `Java ${LATEST} e mais novos`],
            ['Plantas balançando', 'Só 1.17 – 1.21.4 e 1.21.6 – 1.21.10'],
            ['Sombras reais, reflexos, raios de luz', 'Impossível sem Iris ou OptiFine'],
          ],
        ),
        p(`O Java ${LATEST} trouxe um efeito de tela cheia sempre ativo, por isso o bloom e uma correção de cor mais limpa funcionam nele. As versões 1.16.5 e anteriores não têm shaders do mundo substituíveis.`),
        callout('warn', 'Uma versão exata', 'A Mojang muda esses arquivos de shader com frequência, então um shader pack vanilla só funciona na versão para a qual foi feito. Um shader quebrado pode fazer o Minecraft desativar todos os seus pacotes de recursos; por isso cada shader que o Shader Maker escreve é verificado na compilação antes.'),
        h3('Faça um'),
        steps(VANILLA_SHADER_STEPS),
        figure(SHOTS.shaderVanilla),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock: Visuais Vibrantes no lugar de shaders',
      body: [
        p('O Bedrock parou de carregar código de shader próprio quando passou para o motor RenderDragon (1.16.200 no Windows e nos consoles, 1.18.30 nos outros aparelhos). Ferramentas que trocam os arquivos de shader compilados do jogo precisam de instalações modificadas e quebram com as atualizações.'),
        p(
          'O caminho oficial são os ',
          strong('Visuais Vibrantes'),
          ' (Vibrant Visuals): o renderizador moderno do Bedrock, no jogo estável desde a 1.21.90 (junho de 2025). Um pacote de recursos pode mudar as configurações dele: luz do sol e da lua, cores do céu, neblina, água, sombras e correção de cor, conforme a hora do dia e o bioma. ',
          link('/guides/bedrock-vibrant-visuals-settings', 'Configurações dos Visuais Vibrantes explicadas'),
          '.',
        ),
      ],
    },
    {
      id: 'mods',
      title: 'Shaders sem OptiFine: use o Iris',
      body: [
        p(
          `Se “sem mods” quer dizer “sem OptiFine”, a resposta é o Iris. Ele carrega os mesmos shader packs (sombras reais do sol, folhas balançando, água com reflexo, raios de luz), roda junto com o mod de desempenho Sodium e está disponível do Java 1.16.5 ao ${LATEST}. No momento em que este guia foi escrito, o OptiFine vai até a 26.2.`,
        ),
        steps([
          ['Baixe o instalador do Iris em ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' e execute. Ele instala o Iris e o Sodium para a versão que você escolher.'],
          'Inicie o jogo uma vez com o novo perfil do Iris no Minecraft Launcher.',
          ['Abra ', uiPath(OPTIONS, VIDEO, IRIS_SHADERS), ', clique em ', strong('Abrir pasta de pacotes'), ' e coloque lá o zip de um shader pack.'],
          'Escolha o pack na lista e clique em Aplicar. Packs mais leves combinam com notebooks; os mais pesados pedem uma placa de vídeo forte.',
        ]),
        figure(SHOTS.shaderIris),
        p('No Forge ou no NeoForge, procure uma versão do Iris para esse loader. Você também pode criar seu próprio shader pack de Iris / OptiFine, com presets e prévia ao vivo, no ', link('/shaders', 'Shader Maker'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'optifine', q: 'Precisa de OptiFine para shaders vanilla?', a: [p('Não. Shader packs vanilla são pacotes de recursos comuns. Eles funcionam sem nenhum mod na versão para a qual foram feitos.')] },
    { id: 'servers', q: 'Shader packs vanilla funcionam em servidores?', a: [p('Sim. Os pacotes de recursos são aplicados pelo seu próprio jogo, então funcionam também quando você joga em um servidor.')] },
    { id: 'bedrock', q: 'Posso usar shaders do Java no Bedrock?', a: [p('Não. O Bedrock não carrega código de shader de packs. Use um pacote de Visuais Vibrantes.')] },
  ],
  ctaLabel: 'Abrir o Shader Maker',
};

const javaVsBedrock: GuideText = {
  intro: [
    p(
      'O Java e o Bedrock têm pacotes de recursos, mas os arquivos não são intercambiáveis. Um pack do ',
      strong('Java'),
      ' é um ',
      code('.zip'),
      ' com ',
      code('pack.mcmeta'),
      ' e texturas PNG em ',
      code('assets/minecraft/textures/'),
      '. Um pack do ',
      strong('Bedrock'),
      ' é um ',
      code('.mcpack'),
      ' com ',
      code('manifest.json'),
      ' e texturas em ',
      code('textures/'),
      '. Para ter os dois, você faz o pack duas vezes.',
    ),
  ],
  quick: {
    title: 'Resposta rápida: texture packs do Java funcionam no Bedrock?',
    items: [
      'Não. O Bedrock não carrega um .zip do Java, e renomear para .mcpack não adianta.',
      'As duas edições usam pastas, nomes de arquivo e arquivos de descrição diferentes.',
      'Dá para converter um pack movendo e renomeando as imagens e adicionando um manifest.json, ou refazer em um projeto do Bedrock.',
    ],
  },
  sections: [
    {
      id: 'compare',
      title: 'Lado a lado',
      body: [
        table(
          ['', 'Java Edition', 'Bedrock Edition'],
          [
            ['Arquivo', [code('.zip'), ' (ou uma pasta)'], [code('.mcpack'), ' (um zip renomeado)']],
            ['Arquivo de descrição', [code('pack.mcmeta')], [code('manifest.json'), ' com dois UUIDs e um número de versão']],
            ['Versão de destino', ['Um número de pack format, por ex. ', F(LATEST), ' para a ', LATEST], ['Uma versão mínima do motor, por ex. ', code(MIN_ENGINE)]],
            ['Exemplo de caminho de textura', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
            ['Formatos de imagem', 'PNG', 'PNG ou TGA (mantenha a extensão do arquivo vanilla)'],
            ['Ícone', [code('pack.png')], [code('pack_icon.png')]],
            ['Instalação', ['Colocar na pasta ', code('resourcepacks')], 'Abrir o arquivo; o Minecraft importa'],
            ['Shaders', 'Shader packs de Iris / OptiFine, ou pacotes de recursos com shaders vanilla (1.17+)', 'Sem código de shader próprio; pacotes de configurações de Visuais Vibrantes'],
            ['Skins', 'Um PNG enviado no launcher ou em minecraft.net', 'Um pacote de skins (.mcpack) ou um PNG importado no Vestiário'],
            ['Consoles', 'Não se aplica', 'Não importam arquivos; use um mundo, Realm ou servidor que tenha o pack'],
          ],
        ),
      ],
    },
    {
      id: 'textures',
      title: 'Diferenças de textura para ficar de olho',
      body: [
        ul([
          'Os nomes de arquivo mudam entre as edições, por exemplo block/grass_block_top.png no Java e blocks/grass_top.png no Bedrock.',
          'Muitas texturas do Bedrock usam os pixels transparentes para guardar máscaras de tonalidade ou de tinta, então um editor nunca deve descartar a cor dos pixels invisíveis. O Texture Pack Maker mantém os pixels exatos.',
          'O Java pode misturar versões em um pack com uma faixa de compatibilidade; os packs do Bedrock declaram uma única versão mínima.',
        ]),
      ],
    },
    {
      id: 'convert',
      title: 'Dá para converter um texture pack do Java para o Bedrock?',
      body: [
        p('Sim, mas não renomeando o arquivo. Converter quer dizer remontar o pack na estrutura do Bedrock:'),
        steps([
          ['Copie as imagens de ', code('assets/minecraft/textures/'), ' para as pastas ', code('textures/'), ' do Bedrock (', code('block'), ' → ', code('blocks'), ', ', code('item'), ' → ', code('items'), ').'],
          ['Renomeie os arquivos com nomes diferentes, por exemplo ', code('grass_block_top.png'), ' → ', code('grass_top.png'), '. Texturas sem equivalente no Bedrock ficam de fora.'],
          ['Escreva um ', code('manifest.json'), ' com dois UUIDs novos, uma versão e uma ', code('min_engine_version'), ', e renomeie ', code('pack.png'), ' para ', code('pack_icon.png'), '.'],
          ['Confira os casos especiais: as animações do Bedrock ficam listadas em ', code('textures/flipbook_textures.json'), ' em vez de arquivos ', code('.png.mcmeta'), ', e algumas texturas são arquivos ', code('.tga'), ' que guardam máscaras de tonalidade nos pixels transparentes.'],
          ['Compacte o conteúdo e renomeie o zip para ', code('.mcpack'), '.'],
        ]),
        p(
          'A referência da própria Mojang é ',
          ext('https://learn.microsoft.com/pt-br/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition'),
          '. O caminho rápido é o ',
          link('/texture-pack-converter', 'conversor de texture pack'),
          ': ele move e renomeia cada textura, transforma as animações em entradas de flipbook, escreve o manifesto e lista o que não conseguiu converter.',
        ),
      ],
    },
    {
      id: 'mcpack',
      title: 'Um .mcpack é só um arquivo zip?',
      body: [
        p(
          'Sim. Um ',
          code('.mcpack'),
          ' é um zip comum com outra extensão, para o Bedrock saber que deve importar. Renomeie para ',
          code('.zip'),
          ' para ver o que tem dentro. O que faz dele um pack do Bedrock é o conteúdo: o ',
          code('manifest.json'),
          ' na raiz e a estrutura de pastas do Bedrock. Arquivos ',
          code('.mcaddon'),
          ' juntam vários packs, e arquivos ',
          code('.mcworld'),
          ' guardam um mundo inteiro.',
        ),
      ],
    },
    {
      id: 'both',
      title: 'Fazer um pack para as duas edições',
      body: [
        steps([
          ['Crie um projeto do Java no ', link('/textures', 'Texture Pack Maker'), ' e pinte suas texturas.'],
          'Crie um projeto do Bedrock e repinte (ou envie) as mesmas texturas lá; a lista de arquivos é a do Bedrock.',
          'Exporte cada um e compartilhe os dois arquivos.',
        ]),
      ],
    },
  ],
  faq: [
    { id: 'convert', q: 'Posso converter um pack do Java para o Bedrock?', a: [p('Não renomeando o arquivo. As pastas, os nomes e o arquivo de descrição são diferentes, então as imagens precisam ser movidas, renomeadas e ganhar um manifest.json. O ', link('/texture-pack-converter', 'conversor de texture pack'), ' faz isso para você.')] },
    { id: 'back', q: 'Posso converter um pack do Bedrock para o Java?', a: [p('Do mesmo jeito, ao contrário: mova as imagens para ', code('assets/minecraft/textures/'), ', renomeie com os nomes do Java, converta os .tga para PNG e adicione um ', code('pack.mcmeta'), '.')] },
    { id: 'missing', q: 'Por que algumas texturas somem depois de converter?', a: [p('Cada edição tem texturas que a outra não tem, e algumas são divididas ou combinadas de outro jeito (por exemplo baús, pinturas e a interface). Essas precisam ser repintadas para a outra edição.')] },
    { id: 'which', q: 'Qual edição eu jogo?', a: [p('Se você joga em console, celular ou tablet, ou comprou o Minecraft na Microsoft Store como “Minecraft para Windows”, é o Bedrock. O Java roda no Windows, macOS e Linux pelo Minecraft Launcher.')] },
  ],
  ctaLabel: 'Abrir o Texture Pack Maker',
};

// ---------------------------------------------------------------- vibrant visuals

const VV_STEPS: Child[] = [
  ['Crie um pack no ', link('/shaders', 'Shader Maker'), ' (escolha ', strong('Bedrock Vibrant Visuals'), ') e exporte o ', code('.mcpack'), '.'],
  'Abra o arquivo. O Minecraft importa automaticamente.',
  ['Vá em ', uiPath('Opções', 'Recursos globais', 'Meus Pacotes'), ' e ative o pack. Desative os texture packs clássicos que não suportam Visuais Vibrantes.'],
  ['Abra ', uiPath('Opções', 'Vídeo'), ' e coloque ', strong('Modos de Gráfico'), ' em ', strong('Visuais Vibrantes'), '.'],
];

const vibrantVisuals: GuideText = {
  image: SHOTS.vibrantVisuals,
  intro: [
    p(
      strong('Visuais Vibrantes'),
      ' (Vibrant Visuals) é o modo gráfico moderno do Minecraft Bedrock, com luz do sol direcional, sombras suaves, neblina volumétrica, água com reflexos e materiais com renderização física (PBR). Saiu dos experimentos na 1.21.90 (junho de 2025) e é o modo gráfico padrão nos aparelhos compatíveis. Um pacote de recursos pode ajustar as configurações dele, mas não pode adicionar código de shader novo.',
    ),
  ],
  howto: { name: 'Como usar um pacote de Visuais Vibrantes no Minecraft Bedrock', steps: VV_STEPS },
  sections: [
    {
      id: 'settings',
      title: 'O que um pacote de Visuais Vibrantes pode mudar',
      body: [
        table(
          ['Pasta do pack', 'O que controla'],
          [
            [code('lighting/'), 'Brilho, cor e inclinação da trajetória do sol e da lua, luz ambiente (em cavernas), luz do céu e o quanto os blocos que brilham são coloridos.'],
            [code('atmospherics/'), 'As cores do céu no alto e no horizonte, e como a luz se espalha no ar (densidade do céu, brilho do pôr do sol).'],
            [code('color_grading/'), 'O operador de mapeamento de tons, contraste, saturação, ganho, gama e temperatura de cor: o visual de filme.'],
            [code('water/'), 'Cor da água, ondas e cáusticas (os desenhos de luz embaixo d’água).'],
            [code('shadows/'), 'Sombras quadradas ou suaves.'],
            [code('fogs/'), 'Densidade e cor da neblina volumétrica, e a neblina de distância clássica.'],
            [code('local_lighting/'), 'A cor da luz de blocos como tochas e lanternas.'],
          ],
        ),
        p('As configurações podem mudar com a hora do dia, e os valores do próprio Minecraft variam conforme o bioma, então um bom pack ajusta cada bioma em vez de substituir um único arquivo global.'),
        p(strong('Não dá para ajustar com packs: '), 'bloom, exposição, reflexos em espaço de tela, iluminação das nuvens, a própria curva de mapeamento de tons, distância de renderização e anti-aliasing. Isso fica no motor gráfico do jogo, não nos pacotes de recursos.'),
      ],
    },
    {
      id: 'devices',
      title: 'Quais aparelhos suportam',
      body: [
        ul(['PCs com Windows e DirectX 12.', 'Xbox Series e PlayStation 5; no Xbox One e no PS4 vem desligado por padrão.', 'iPhone e iPad com chip A12 ou mais novo.', 'Muitos aparelhos Android recentes.']),
        p('Não está disponível no Nintendo Switch original, em Chromebooks nem em tablets Fire. Servidores podem desligar, e a tela dividida usa os gráficos clássicos no lugar.'),
      ],
    },
    {
      id: 'enable',
      title: 'Ative com um pack',
      body: [
        steps(VV_STEPS),
        callout(
          'warn',
          'Visuais Vibrantes aparece em cinza?',
          'O Minecraft só libera quando todos os pacotes de recursos ativos suportam. Texture packs clássicos desligam o modo, então desative-os (ou use um pack feito para Visuais Vibrantes). A opção também precisa de um aparelho compatível.',
        ),
        figure(SHOTS.vibrantVisuals),
      ],
    },
  ],
  faq: [
    { id: 'what', q: 'O que é Visuais Vibrantes no Minecraft?', a: [p('O modo gráfico moderno que já vem no Bedrock, lançado na 1.21.90. Ele traz iluminação direcional, sombras, neblina volumétrica, reflexos na água e materiais PBR sem add-ons.')] },
    { id: 'textures', q: 'Visuais Vibrantes precisa de um texture pack especial?', a: [p('Não, funciona com as texturas padrão. Mas um texture pack clássico que não declara suporte a Visuais Vibrantes desliga o modo enquanto estiver ativo.')] },
    { id: 'classic-fog', q: 'Mudanças na neblina funcionam sem Visuais Vibrantes?', a: [p('A neblina de distância clássica pode ser mudada em qualquer modo gráfico. A neblina volumétrica e as configurações de iluminação só valem com Visuais Vibrantes.')] },
  ],
  ctaLabel: 'Criar um pacote de Visuais Vibrantes',
};

// ---------------------------------------------------------------- convert java to bedrock

const CONVERT_STEPS: Child[] = [
  ['Abra o ', link('/texture-pack-converter', 'conversor de texture pack'), ' e escolha seu pack: um ', code('.zip'), ' do Java, um ', code('.mcpack'), ' do Bedrock ou texturas PNG.'],
  ['Escolha para o que converter: ', strong('Bedrock Edition'), ', ou ', strong('Java Edition'), ' e uma versão.'],
  ['Clique em ', strong('Convert'), '. Seu navegador carrega a lista de texturas da edição de destino e converte todas as que consegue.'],
  'Leia o relatório: quantas texturas foram convertidas, quais foram puladas e por quê.',
  'Baixe o pack convertido, ou abra no editor para repintar antes as texturas puladas.',
];

const convertJavaToBedrock: GuideText = {
  image: SHOTS.convertResult,
  intro: [
    p(
      'Um texture pack do Java não funciona no Bedrock, e renomear o ',
      code('.zip'),
      ' para ',
      code('.mcpack'),
      ' não resolve: as duas edições usam pastas, nomes de arquivo e arquivos de descrição diferentes. Para converter um pack, cada textura precisa ir para a pasta do Bedrock, ganhar o nome de arquivo do Bedrock e vir com um ',
      code('manifest.json'),
      '. O ',
      link('/texture-pack-converter', 'conversor de texture pack'),
      ' grátis faz isso no seu navegador em poucos segundos, e funciona no sentido contrário também.',
    ),
  ],
  quick: {
    title: 'Resumindo',
    items: [
      ['Abra o ', link('/texture-pack-converter', 'conversor de texture pack'), ' e escolha seu ', code('.zip'), ' do Java.'],
      ['Escolha ', strong('Bedrock Edition'), ' e clique em ', strong('Convert to Bedrock'), '.'],
      ['Baixe o ', code('.mcpack'), ' e abra: o Minecraft importa.'],
    ],
  },
  howto: { name: 'Como converter um texture pack do Java para o Bedrock', steps: CONVERT_STEPS },
  sections: [
    { id: 'steps', title: 'Passo a passo', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
    {
      id: 'what',
      title: 'O que converte e o que não converte',
      body: [
        p('O conversor sabe qual textura do Java faz o mesmo papel de cada textura do Bedrock, com base nos arquivos do jogo das duas edições. A maioria das texturas tem a mesma imagem nas duas, então dá para copiar como está.'),
        table(
          ['Converte', 'Não converte'],
          [
            ['A maioria das texturas de blocos e itens (umas quatro em cada cinco)', 'Texturas que só existem em uma edição'],
            ['Muitas texturas de mobs e do ambiente (sol, lua, nuvens)', 'Texturas com outro layout: baús, muitas skins de mobs, estandartes, os menus e as partículas'],
            ['Texturas animadas: o .png.mcmeta vira uma entrada de flipbook', 'Modelos, sons, fontes, textos de abertura e shaders'],
            ['O ícone, o nome e a descrição do pack', 'Extras do OptiFine como texturas conectadas e texturas de itens personalizadas'],
          ],
        ),
        p('Tudo o que foi pulado aparece no relatório com o motivo, então você sabe exatamente o que repintar. Abra o pack convertido no ', link('/textures', 'Texture Pack Maker'), ' para arrumar essas texturas nos modelos 3D antes de baixar.'),
        callout('tip', 'O mesmo pack nas duas edições', 'Guarde seu pack do Java como original e converta de novo depois de cada mudança. Antes de importar a versão nova no Bedrock, apague a antiga em Opções › Armazenamento para não ficar com duas cópias.'),
      ],
    },
    {
      id: 'bedrock-to-java',
      title: 'Converter um pack do Bedrock para o Java',
      body: [
        p(
          'Escolha um ',
          code('.mcpack'),
          ' (ou ',
          code('.mcaddon'),
          ') do Bedrock e selecione ',
          strong('Java Edition'),
          ' e a versão que você joga. As texturas vão para as pastas e os nomes do Java, imagens ',
          code('.tga'),
          ' viram PNG, animações de flipbook viram arquivos ',
          code('.png.mcmeta'),
          ' e o pack recebe o ',
          code('pack.mcmeta'),
          ' certo para essa versão.',
        ),
      ],
    },
    {
      id: 'old-java',
      title: 'Atualizar um pack antigo do Java para uma versão nova',
      body: [
        p(
          'O mesmo conversor atualiza packs do Java entre versões. Muitas texturas mudaram de nome ao longo dos anos, principalmente na 1.13, quando ',
          code('textures/blocks'),
          ' virou ',
          code('textures/block'),
          ' e centenas de arquivos ganharam nomes novos. Escolha o pack antigo, selecione ',
          strong('Java'),
          ' e a sua versão, e cada textura renomeada vai para o nome novo. Os nomes de textura dentro dos modelos do próprio pack também são atualizados.',
        ),
        p(`Funciona ao contrário também, por exemplo para transformar um pack da ${LATEST} em um para a 1.8.9.`),
      ],
    },
    {
      id: 'install',
      title: 'Instalar o pack convertido',
      body: [
        ul([
          ['Bedrock: abra o ', code('.mcpack'), ' (clique duas vezes no Windows, “Abrir com o Minecraft” no celular) e ative em ', uiPath('Opções', 'Recursos globais'), '.'],
          ['Java: coloque o ', code('.zip'), ' na pasta ', code('resourcepacks'), ' e passe para Selecionados.'],
        ]),
        p('Mais detalhes em ', link('/guides/install-resource-packs', 'Como instalar texture packs'), '. Se algo parecer errado, veja ', link('/guides/texture-pack-not-working', 'Texture pack não funciona'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'O conversor é grátis?', a: [p('Sim, sem conta e sem limites. O pack é convertido no seu navegador e nunca é enviado.')] },
    { id: 'look', q: 'O pack vai ficar igual no Bedrock?', a: [p('As texturas convertidas ficam iguais. As puladas usam as do próprio Bedrock, e a iluminação do Bedrock e os Visuais Vibrantes podem deixar as cores um pouco diferentes.')] },
    { id: 'shaders', q: 'Posso converter um shader pack do Java para o Bedrock?', a: [p('Não. O Bedrock não carrega código de shader próprio. Use no lugar um pacote de ', link('/guides/bedrock-vibrant-visuals-settings', 'Visuais Vibrantes'), ', que você pode criar no ', link('/shaders', 'Shader Maker'), '.')] },
    { id: 'png', q: 'Posso transformar arquivos PNG em um .mcpack?', a: [p('Sim. Escolha um PNG, ou um zip de PNGs, com os nomes das texturas do jogo (por exemplo ', code('stone.png'), '), e converta para o Bedrock.')] },
    { id: 'console', q: 'Posso usar o pack convertido no console?', a: [p('Consoles não importam arquivos. Adicione o pack a um mundo em um PC ou celular e entre nesse mundo, ou use um Realm ou servidor que tenha o pack.')] },
  ],
  ctaLabel: 'Abrir o conversor de texture pack',
};

// ---------------------------------------------------------------- merge packs

const MERGE_STEPS: Child[] = [
  ['Abra ', link('/merge-texture-packs', 'Juntar texture packs'), ' e adicione de dois a oito packs: arquivos ', code('.zip'), ' do Java ou ', code('.mcpack'), ' do Bedrock.'],
  'Coloque em ordem arrastando ou com os botões de seta. O pack de cima vence onde dois packs mudam o mesmo arquivo.',
  'Dê um nome ao pack juntado e escolha o ícone. No Java, escolha também a versão que você joga.',
  ['Clique em ', strong('Merge'), ' e confira a lista de conflitos.'],
  'Baixe o pack juntado, ou abra no editor para continuar trabalhando nele.',
];

const mergePacks: GuideText = {
  image: SHOTS.mergeResult,
  intro: [
    p(
      'O Minecraft já empilha texture packs: ative vários, e o que estiver mais acima na lista vence onde dois mudam a mesma textura. Juntar cria um pack só a partir de vários, com essa mesma ordem já embutida. É útil para um servidor ou Realm que aceita um único pack, para compartilhar sua combinação favorita ou para deixar sua lista de packs curta. A ferramenta grátis ',
      link('/merge-texture-packs', 'Juntar texture packs'),
      ' faz isso no seu navegador.',
    ),
  ],
  quick: {
    title: 'Resumindo',
    items: [
      ['Abra ', link('/merge-texture-packs', 'Juntar texture packs'), ' e adicione de dois a oito packs da mesma edição.'],
      'Arraste para colocar em ordem: o pack de cima vence todos os conflitos.',
      'Clique em Merge, confira a lista de conflitos e baixe o pack.',
    ],
  },
  howto: { name: 'Como juntar texture packs de Minecraft', steps: MERGE_STEPS },
  sections: [
    { id: 'steps', title: 'Passo a passo', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
    {
      id: 'wins',
      title: 'Qual pack vence?',
      body: [
        p('A mesma regra do Minecraft: em cada arquivo, vence o pack mais acima na lista. Uma textura e seu arquivo de animação sempre andam juntos, então a animação de um pack de baixo nunca fica presa à imagem de um pack de cima.'),
        p('Alguns arquivos são combinados em vez de substituídos, para nada útil se perder:'),
        ul([
          [strong('Java: '), 'arquivos de idioma (chave por chave), ', code('sounds.json'), ' (som por som), atlas de texturas e fontes.'],
          [strong('Bedrock: '), code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ', definições de som e arquivos de idioma.'],
        ]),
        p('O resultado lista cada conflito, como “block/stone.png do Pack A, por cima do Pack B”, e quantos arquivos cada pack trouxe.'),
      ],
    },
    {
      id: 'versions',
      title: 'Packs para versões diferentes',
      body: [
        p(
          'Dá para juntar packs do Java feitos para versões diferentes: escolha a versão que você joga e os packs mais antigos recebem antes os nomes de textura dela (as mesmas renomeações que o ',
          link('/texture-pack-converter', 'conversor'),
          ` usa), então um pack da 1.12 e um da ${LATEST} se encaixam. Packs do Java e do Bedrock não podem ser juntados direto: converta um deles primeiro.`,
        ),
      ],
    },
    {
      id: 'by-hand',
      title: 'Juntar packs à mão',
      body: [
        steps([
          'Descompacte cada pack em uma pasta própria.',
          'Crie uma pasta nova e copie primeiro o pack de menor prioridade, depois cada pack de cima por cima dele, substituindo os arquivos quando perguntar.',
          ['Junte à mão os arquivos que devem ser combinados (', code('sounds.json'), ', arquivos de idioma, atlas), senão a última cópia vence.'],
          ['Deixe um só ', code('pack.mcmeta'), ' (Java) ou escreva um ', code('manifest.json'), ' novo com IDs novos (Bedrock) e compacte o conteúdo em um zip.'],
        ]),
        p('A ferramenta faz tudo isso, inclusive os arquivos combinados e o pack format certo, então juntar à mão só vale a pena com packs fora do comum.'),
      ],
    },
  ],
  faq: [
    { id: 'how-many', q: 'Quantos packs posso juntar?', a: [p('De dois a oito por vez. Para juntar mais, junte o resultado de novo com os próximos packs.')] },
    { id: 'shaders', q: 'Posso juntar shader packs?', a: [p('Não. Shader packs do Iris e do OptiFine só rodam um de cada vez. Pacotes de recursos de shaders vanilla podem ser juntados como qualquer pacote de recursos, mas dois packs que mudam o mesmo arquivo de shader não somam os efeitos.')] },
    { id: 'server', q: 'Posso usar um pack juntado como pacote de recursos do servidor?', a: [p('Sim. Envie o ', code('.zip'), ' juntado para onde você hospeda os packs do servidor e configure no ', code('server.properties'), ' como qualquer outro pack.')] },
    { id: 'upload', q: 'Meus packs são enviados para algum lugar?', a: [p('Não. Os packs são juntados no seu navegador e ficam no seu dispositivo.')] },
  ],
  ctaLabel: 'Abrir Juntar texture packs',
};

// ---------------------------------------------------------------- bedrock skin pack

const SKIN_PACK_STEPS: Child[] = [
  ['Abra o ', link('/skin-pack-maker', 'criador de pacote de skins'), ' e comece uma skin: um modelo em branco ou por cores, um PNG que você já tem, a skin de um jogador do Java pelo nome de usuário ou uma das skins padrão. Escolha braços clássicos (4 pixels) ou finos (3 pixels).'],
  'Pinte no modelo 64×64 ou direto no modelo 3D. Cada skin fica salva no seu dispositivo como um projeto separado, e o nome dela é o nome que os jogadores veem no jogo.',
  'Faça as outras skins do pacote do mesmo jeito.',
  ['Abra uma delas, escolha ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', dê um nome ao pacote, marque as outras skins que vão junto e toque em ', strong('Download pack'), '.'],
  ['Abra o ', code('.mcpack'), ' no Windows, Android, iPhone ou iPad. O Minecraft importa.'],
  ['No Minecraft vá em ', uiPath('Vestiário', 'Aparências Clássicas'), ', ache seu pacote, escolha uma skin e toque em ', strong('Equipar'), '.'],
];

const bedrockSkinPack: GuideText = {
  image: SHOTS.skinPack,
  intro: [
    p(
      strong('Sim, dá para fazer seu próprio pacote de skins para o Minecraft Bedrock, de graça.'),
      ' Um pacote de skins (skin pack) é um arquivo ',
      code('.mcpack'),
      ' com uma ou mais skins e dois arquivos pequenos de descrição, ',
      code('manifest.json'),
      ' e ',
      code('skins.json'),
      '. Pinte ou envie suas skins no ',
      link('/skin-pack-maker', 'criador de pacote de skins'),
      ', baixe o pacote, abra no Windows, Android, iPhone ou iPad e use suas skins pelo Vestiário. Vender um pacote no Marketplace do Minecraft é outra história: só parceiros do Marketplace aprovados pela Mojang podem publicar lá.',
    ),
  ],
  quick: {
    title: 'Resumindo',
    items: [
      ['Pinte ou envie cada skin no ', link('/skin-pack-maker', 'criador de pacote de skins'), ', com braços clássicos ou finos.'],
      ['Escolha ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', dê um nome ao pacote e marque as outras skins.'],
      ['Abra o ', code('.mcpack'), ' e equipe uma skin em ', uiPath('Vestiário', 'Aparências Clássicas'), '.'],
    ],
  },
  howto: { name: 'Como fazer um pacote de skins do Minecraft Bedrock', steps: SKIN_PACK_STEPS },
  sections: [
    {
      id: 'what',
      title: 'O que tem dentro de um pacote de skins?',
      body: [
        p('Um pacote de skins é um arquivo zip renomeado para ', code('.mcpack'), '. Na raiz dele ficam estes arquivos:'),
        table(
          ['Arquivo', 'Para que serve'],
          [
            [code('manifest.json'), ['O nome do pacote, dois IDs únicos (UUIDs) e um número de versão. O tipo de módulo ', code('skin_pack'), ' avisa o Minecraft que é um pacote de skins, não um texture pack.']],
            [code('skins.json'), ['A lista de skins: de cada uma, a chave do nome, o PNG, o modelo (', code('geometry.humanoid.custom'), ' para braços clássicos, ', code('geometry.humanoid.customSlim'), ' para finos) e ', code('"type": "free"'), '.']],
            ['Imagens das skins', ['Um PNG 64×64 por skin, ao lado do ', code('manifest.json'), '.']],
            [code('texts/en_US.lang'), ['Os nomes que aparecem no Vestiário, do pacote e de cada skin. O ', code('texts/languages.json'), ' lista os arquivos de idioma.']],
          ],
        ),
        p(code('"type": "free"'), ' quer dizer que qualquer um que tenha o pacote pode usar a skin. Pacotes do Marketplace marcam a maioria das skins como ', code('"paid"'), ', que só são liberadas depois da compra, então um pacote feito por você sempre usa “free”.'),
      ],
    },
    {
      id: 'steps',
      title: 'Faça no criador de pacote de skins',
      body: [
        steps(SKIN_PACK_STEPS),
        figure(SHOTS.skinPack),
        p(
          'O criador escreve para você o ',
          code('manifest.json'),
          ', o ',
          code('skins.json'),
          ' e o arquivo de idioma, com IDs novos para cada pacote. Skins clássicas e finas podem dividir o pacote, cada skin mantém o próprio nome, e o nome que você der ao pacote é o título que os jogadores veem acima das skins.',
        ),
        figure(SHOTS.skin3d),
      ],
    },
    {
      id: 'install',
      title: 'Instale no Windows, Android e iOS',
      body: [
        tabbed(
          'install-skin-pack',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Clique duas vezes no ', code('.mcpack'), '. O Minecraft abre e mostra ', el('em', null, 'Importação iniciada...'), ' e depois que a importação deu certo.'],
                  ['Abra ', uiPath('Vestiário', 'Aparências Clássicas'), ', escolha uma skin do seu pacote e toque em ', strong('Equipar'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android e iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Baixe o ', code('.mcpack'), ' no celular ou tablet.'],
                  [strong('Android: '), 'abra pelos Downloads ou pelo app de arquivos e escolha o Minecraft. ', strong('iPhone / iPad: '), 'toque no arquivo no app Arquivos e depois em ', uiPath('Compartilhar', 'Minecraft'), '.'],
                  ['Abra ', uiPath('Vestiário', 'Aparências Clássicas'), ' e equipe uma skin do seu pacote.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation e Switch não importam pacotes de skins nem arquivos de skin. Nos consoles, o visual personalizado vem do Criador de Personagens ou de pacotes de skins do Marketplace.')],
            },
          ],
          UI_PT_BR.platform,
        ),
        callout(
          'tip',
          'Só uma skin?',
          'Para uma skin só, você não precisa de pacote: em Aparências Clássicas, abra as suas aparências, escolha Importar e selecione um PNG 64×64. Um pacote é mais prático para várias skins, mantém os nomes e instala do mesmo jeito em qualquer aparelho.',
        ),
      ],
    },
    {
      id: 'update',
      title: 'Atualizar ou apagar um pacote de skins',
      body: [
        p('Para mudar um pacote que você já importou, edite as skins, exporte o pacote de novo a partir do mesmo projeto e abra o arquivo novo. O criador mantém os dois IDs do pacote e aumenta a versão (1.0.0, depois 1.0.1 e assim por diante), então o Minecraft substitui o pacote instalado em vez de mostrar dois.'),
        p('Fez o pacote à mão? Mantenha os dois UUIDs e aumente a versão no ', code('manifest.json'), ', no cabeçalho e no módulo. UUIDs novos criam um segundo pacote, e a mesma versão não é importada de novo porque esse pacote já está instalado.'),
        p('Para apagar um pacote, vá em ', uiPath('Opções', 'Armazenamento'), ', selecione e apague.'),
      ],
    },
    {
      id: 'arms',
      title: 'Braços clássicos ou finos',
      body: [
        p(
          'Cada skin do pacote tem o próprio modelo, então um pacote pode misturar os dois. Braços ',
          strong('clássicos'),
          ' (Steve) têm 4 pixels de largura e usam ',
          code('geometry.humanoid.custom'),
          '; braços ',
          strong('finos'),
          ' (Alex) têm 3 pixels e usam ',
          code('geometry.humanoid.customSlim'),
          '. O modelo precisa combinar com o jeito que a skin foi pintada; senão os braços parecem cortados ou ganham uma faixa transparente.',
        ),
        p('Pacotes importados só podem usar esses dois modelos. Formatos próprios, como uma cabeça gigante, não são permitidos em um pacote de skins que você mesmo importa.'),
      ],
    },
    {
      id: 'by-hand',
      title: 'Fazer um pacote de skins à mão',
      body: [
        p('Você também pode escrever os arquivos em qualquer editor de texto. Um pacote com duas skins fica assim:'),
        pre(SKIN_PACK_TREE),
        p('O ', code('manifest.json'), ' precisa de dois UUIDs diferentes. Gere os seus em qualquer gerador de UUID em vez de copiar os de baixo, e guarde para as próximas atualizações:'),
        pre(SKIN_PACK_MANIFEST.trimEnd()),
        p('O ', code('skins.json'), ' lista as skins. ', code('serialize_name'), ' e ', code('localization_name'), ' são o ID do pacote: uma palavra sem espaços que nenhum outro pacote usa. O criador de pacote de skins acrescenta o começo do UUID do pacote para garantir.'),
        pre(SKIN_PACK_SKINS_JSON.trimEnd()),
        p('O ', code('texts/en_US.lang'), ' guarda os nomes que aparecem no jogo, e o ', code('texts/languages.json'), ' contém ', code('["en_US"]'), ':'),
        pre(SKIN_PACK_LANG.trimEnd()),
        steps([
          ['Coloque os arquivos em uma pasta como mostrado, com os PNGs ao lado do ', code('manifest.json'), '.'],
          'Selecione os arquivos dentro da pasta, não a pasta em si, e compacte em um zip.',
          ['Renomeie o zip de ', code('.zip'), ' para ', code('.mcpack'), ' e abra.'],
        ]),
        p('Se a importação falhar, a causa costuma ser uma pasta em volta dos arquivos dentro do zip, um erro de digitação no JSON ou dois UUIDs iguais. O ', link('/skin-pack-maker', 'criador de pacote de skins'), ' escreve exatamente esses arquivos, então você também pode exportar um pacote, renomear para ', code('.zip'), ' e olhar dentro.'),
      ],
    },
    {
      id: 'marketplace',
      title: 'Pacotes do Marketplace e pacotes pessoais',
      body: [
        p('Quer fazer um pacote de skins para o Marketplace do Minecraft? Só parceiros do Marketplace publicam lá: estúdios e criadores que a Mojang aceitou no programa de parceiros e que enviam cada pacote para análise. Não tem como enviar um pacote para o Marketplace pelo jogo ou por um site.'),
        ul([
          [strong('Pacote de skins pessoal: '), 'grátis, qualquer um pode fazer, importado de um ', code('.mcpack'), ' no Windows, Android, iPhone e iPad. Dá para compartilhar o arquivo com os amigos.'],
          [strong('Pacote de skins do Marketplace: '), 'feito por um parceiro aprovado, comprado com Minecoins ou grátis, disponível em todos os aparelhos, inclusive consoles.'],
        ]),
        p('Coloque em um pacote só skins que você mesmo fez ou que tem permissão para compartilhar.'),
      ],
    },
    {
      id: 'trusted',
      title: 'Por que seus amigos podem ver uma skin padrão',
      body: [
        p('O Bedrock tem uma configuração chamada ', strong('Apenas Permitir Aparências Confiáveis'), '. Quem ativa vê toda skin personalizada, inclusive as de pacotes importados, como uma skin padrão, tipo Steve ou Alex. É uma configuração do lado deles, então você não consegue mudar por eles. Todo mundo que não ativou vê sua skin do jeito que você fez.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'Dá para fazer pacotes de skins para o Minecraft Bedrock de graça?', a: [p('Sim. Pacotes de skins pessoais são grátis para fazer e usar no Windows, Android, iPhone e iPad. O criador de pacote de skins não precisa de conta, e suas skins ficam no seu dispositivo.')] },
    { id: 'java', q: 'Pacotes de skins funcionam no Java Edition?', a: [p('Não. Pacotes de skins são do Bedrock. No Java você usa uma skin por vez, enviada como PNG no Minecraft Launcher. ', link('/guides/make-a-skin', 'Como fazer uma skin'), '.')] },
    { id: 'console', q: 'Posso usar um pacote de skins próprio no Xbox, PlayStation ou Switch?', a: [p('Não. Consoles não importam pacotes de skins nem arquivos de skin. Windows, Android, iPhone e iPad importam.')] },
    { id: 'marketplace', q: 'Posso vender meu pacote de skins no Marketplace?', a: [p('Só como parceiro aprovado do Marketplace do Minecraft. Um pacote pessoal pode ser compartilhado como arquivo .mcpack, mas não vendido no jogo.')] },
    { id: 'failed', q: 'Por que a importação falha?', a: [p('Normalmente o zip tem uma pasta em volta dos arquivos, o JSON tem um erro de digitação, os dois UUIDs são iguais ou já tem um pacote instalado com os mesmos IDs e a mesma versão. Pacotes exportados pelo criador de pacote de skins evitam os quatro problemas.')] },
  ],
  ctaLabel: 'Abrir o criador de pacote de skins',
};

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
  'install-resource-packs': install,
  'minecraft-pack-format-versions': packFormats,
  'make-a-skin': makeASkin,
  'make-shaders-without-mods': shadersWithoutMods,
  'java-vs-bedrock-packs': javaVsBedrock,
  'bedrock-vibrant-visuals-settings': vibrantVisuals,
  'convert-java-to-bedrock-texture-pack': convertJavaToBedrock,
  'merge-texture-packs': mergePacks,
  'make-a-bedrock-skin-pack': bedrockSkinPack,
};
