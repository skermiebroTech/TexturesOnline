// Brazilian Portuguese help page (see HelpText in src/tools/help/content.ts). Menu names are the
// ones the Brazilian Portuguese game shows (Java: assets/minecraft/lang/pt_br.json, Bedrock:
// texts/pt_BR.lang).

import { el, type Child } from '../../app/markup';
import { callout, code, ext, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { REPO_URL } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import type { HelpText } from '../../tools/help/content';
import { UI_PT_BR } from './ui';

const p = (...c: Child[]) => el('p', null, ...c);
const FOLDER = UI_PT_BR.folderTable;

const JAVA_PACK_STEPS: Child[] = [
  ['Exporte seu pack no Texture Pack Maker. Você recebe um arquivo como ', code('Meu Pack.zip'), '.'],
  ['Abra o Minecraft Java Edition e vá em ', uiPath('Opções...', 'Pacotes de recursos...'), '.'],
  ['Clique em ', uiPath('Abrir pasta de pacotes'), '. Isso abre a pasta ', code('resourcepacks'), '.'],
  ['Coloque o ', code('.zip'), ' nessa pasta. Você também pode arrastar direto para a tela de pacotes de recursos.'],
  ['Passe o mouse no seu pack na lista ', strong('Disponíveis'), ' e clique na seta para movê-lo para ', strong('Selecionados'), '. Packs mais acima vencem. Clique em ', strong('Concluído'), '.'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['Exporte seu pack. Você recebe um arquivo como ', code('Meu Pack.mcpack'), '.'],
  ['Clique duas vezes no arquivo. O Minecraft abre e mostra ', el('em', null, 'Importação iniciada...'), ' e depois que a importação deu certo.'],
  ['Vá em ', uiPath('Opções', 'Recursos globais', 'Meus Pacotes'), ', selecione seu pack e toque em ', strong('Ativar'), '.'],
  'Usando vários packs? Mova o seu para o topo para ele vencer.',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Abra o Minecraft Launcher e escolha ', uiPath('Minecraft: Java Edition', 'Aparências'), '.'],
  ['Clique em ', strong('Nova aparência'), ' (o cartão com o +).'],
  ['Dê um nome e escolha o modelo do jogador: ', strong('Clássico'), ' ou ', strong('Fino'), '.'],
  ['Clique em ', strong('Procurar'), ', escolha seu PNG e depois ', strong('Salvar e usar'), '.'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  ['Exporte como ', strong('Pacote de skins do Bedrock'), '. Você recebe um arquivo ', code('.mcpack'), '.'],
  'Abra o arquivo (clique duas vezes no Windows, “Abrir com o Minecraft” em celulares e tablets) para importar.',
  ['No Minecraft vá em ', uiPath('Vestiário', 'Aparências Clássicas'), '. Seu pacote aparece junto com os pacotes importados.'],
  ['Escolha sua skin e toque em ', strong('Equipar'), '.'],
];

const IRIS_STEPS: Child[] = [
  ['Baixe o Iris Installer em ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), '. Ele instala o Fabric Loader, o Iris e o Sodium para a sua versão de uma vez.'],
  ['Abra o Minecraft Launcher, escolha o novo perfil ', strong('Iris & Sodium'), ' e jogue uma vez.'],
  ['Exporte seu shader pack no Shader Maker (um ', code('.zip'), ': não descompacte).'],
  ['No jogo abra ', uiPath('Opções...', 'Gráficos...', 'Pacote de sombreadores...'), ' e clique em ', strong('Abrir pasta de pacotes'), '. Coloque o zip lá.'],
  ['Selecione seu pack e clique em ', strong('Aplicar'), '. O botão ', strong('Configurações do pacote'), ' deixa você ajustar as opções no jogo.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Exporte com o destino ', strong('Vanilla Java'), '. Você recebe um pacote de recursos ', code('.zip'), '.'],
  ['Instale como um texture pack: ', uiPath('Opções...', 'Pacotes de recursos...', 'Abrir pasta de pacotes'), ' e coloque o zip lá.'],
  'Mova para Selecionados e clique em Concluído. O visual novo vale na hora.',
];

const VIBRANT_STEPS: Child[] = [
  ['Exporte seu pack (', code('.mcpack'), ') e abra o arquivo para importar.'],
  ['Vá em ', uiPath('Opções', 'Recursos globais', 'Meus Pacotes'), ' e ative o pack.'],
  ['Abra ', uiPath('Opções', 'Vídeo'), ' e coloque ', strong('Modos de Gráfico'), ' em ', strong('Visuais Vibrantes'), '.'],
];

export const HELP: HelpText = {
  sections: {
    'java-packs': {
      title: 'Texture packs no Java',
      short: 'Packs do Java',
      howto: { name: 'Como instalar um texture pack (pacote de recursos) no Minecraft Java Edition', steps: JAVA_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'O Java Edition chama texture packs de ', el('em', null, 'pacotes de recursos'), '. O que você exporta é um arquivo ', code('.zip'), ': não descompacte.'),
        steps(JAVA_PACK_STEPS),
        callout(
          'info',
          'Aparece “Feito para uma versão mais antiga (ou mais recente) do Minecraft”?',
          'Os packs são escritos para a versão que você escolhe no editor. Se você joga outra versão, mude a versão de destino ou a faixa de compatibilidade na aba ',
          strong('Pack'),
          ' e exporte de novo. Packs só de texturas costumam funcionar mesmo assim: você pode clicar em ',
          strong('Sim'),
          ' para usar assim mesmo.',
        ),
        el('h3', { class: 'guide-sub' }, 'Onde fica a pasta'),
        folderTable('resourcepacks', FOLDER),
      ],
    },
    'bedrock-packs': {
      title: 'Texture packs no Bedrock',
      short: 'Packs do Bedrock',
      howto: { name: 'Como instalar um texture pack do Bedrock (.mcpack) no Windows', steps: BEDROCK_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Os packs do Bedrock são exportados como arquivos ', code('.mcpack'), '. Ao abrir um, o Minecraft importa automaticamente.'),
        tabbed(
          'bedrock-packs',
          [
            { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
            {
              value: 'mobile',
              label: 'Android e iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Baixe o ', code('.mcpack'), ' no seu celular ou tablet.'],
                  [strong('Android: '), 'abra pelos Downloads ou pelo app de arquivos e escolha ', strong('Minecraft'), '. ', strong('iPhone / iPad: '), 'no app Arquivos toque no arquivo e depois em ', uiPath('Compartilhar', 'Minecraft'), '.'],
                  ['O Minecraft importa o pack. Depois abra ', uiPath('Opções', 'Recursos globais'), ' e ative.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [
                el(
                  'p',
                  { class: 'muted' },
                  'Xbox, PlayStation e Switch não importam arquivos .mcpack. Adicione o pack a um mundo no PC ou no celular e entre nesse mundo, ou jogue em um Realm ou servidor que tenha o pack.',
                ),
              ],
            },
          ],
          UI_PT_BR.platform,
        ),
        callout('tip', 'Só para um mundo?', 'Em vez de Recursos globais, abra ', uiPath('Editar Mundo', 'Pacotes de recursos'), ' e ative o pack lá.'),
        callout('info', 'Atualizar um pack que você já importou', 'Cada exportação mantém o mesmo ID do pack e aumenta o número da versão, então importar de novo substitui a cópia antiga em vez de criar uma duplicata.'),
      ],
    },
    'java-skins': {
      title: 'Skins no Java',
      short: 'Skins do Java',
      howto: { name: 'Como mudar sua skin no Minecraft Java Edition', steps: JAVA_SKIN_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Exporte sua skin como ', code('.png'), '. Lembre se você pintou o modelo ', strong('Clássico'), ' (braços de 4 pixels) ou o ', strong('Fino'), ' (braços de 3 pixels).'),
        tabbed(
          'java-skins',
          [
            { value: 'launcher', label: 'Minecraft Launcher', icon: 'monitor', content: [steps(JAVA_SKIN_STEPS)] },
            {
              value: 'web',
              label: 'minecraft.net',
              icon: 'globe',
              content: [
                steps([
                  ['Entre em ', ext('https://www.minecraft.net/', 'minecraft.net'), ' e abra seu perfil.'],
                  ['Na parte de skin, escolha o modelo ', strong('Clássico'), ' ou ', strong('Fino'), '.'],
                  ['Envie seu PNG e confirme. Ele aparece no jogo da próxima vez que você entrar em um mundo ou servidor.'],
                ]),
              ],
            },
          ],
          UI_PT_BR.platform,
        ),
        callout('info', 'Joga na 1.7.10 ou anterior?', 'Essas versões só entendem o layout antigo de 64×32. Use a opção de exportação ', strong('Skin antiga do Java (64×32)'), '.'),
      ],
    },
    'bedrock-skins': {
      title: 'Skins no Bedrock',
      short: 'Skins do Bedrock',
      howto: { name: 'Como instalar um pacote de skins do Bedrock (.mcpack)', steps: BEDROCK_SKIN_STEPS },
      body: [
        tabbed(
          'bedrock-skins',
          [
            { value: 'pack', label: 'Pacote de skins (.mcpack)', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
            {
              value: 'png',
              label: 'Um único PNG',
              icon: 'image',
              content: [
                steps([
                  ['Exporte a skin como ', code('.png'), '.'],
                  ['Abra ', uiPath('Vestiário', 'Aparências Clássicas'), ' e, em ', strong('Adquirido'), ', escolha o espaço vazio ', strong('Importar'), '.'],
                  ['Escolha seu PNG e depois o modelo de braço clássico ou fino.'],
                ]),
              ],
            },
          ],
          UI_PT_BR.platform,
        ),
        callout(
          'warn',
          'Seus amigos veem uma skin padrão?',
          'Quem ativa ',
          strong('Apenas Permitir Aparências Confiáveis'),
          ' vê skins personalizadas como uma skin padrão. É uma configuração deles. Consoles não importam arquivos de skin.',
        ),
      ],
    },
    iris: {
      title: 'Shaders com Iris ou OptiFine',
      short: 'Iris / OptiFine',
      howto: { name: 'Como instalar um shader pack com o Iris', steps: IRIS_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Os shader packs clássicos precisam de um mod de shaders. O ', strong('Iris'), ' é o mais fácil e rápido; o OptiFine também funciona.'),
        tabbed(
          'iris',
          [
            { value: 'iris', label: 'Iris (recomendado)', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
            {
              value: 'optifine',
              label: 'OptiFine',
              icon: 'gear',
              content: [
                steps([
                  ['Instale o OptiFine para a sua versão do Minecraft em ', ext('https://optifine.net/', 'optifine.net'), ' e jogue uma vez com o perfil do OptiFine.'],
                  ['Abra ', uiPath('Opções...', 'Gráficos...', 'Shaders...'), ' e clique em ', strong('Pasta de shaders'), '.'],
                  'Coloque o zip exportado na pasta e depois selecione na lista.',
                ]),
              ],
            },
          ],
          UI_PT_BR.platform,
        ),
        el('h3', { class: 'guide-sub' }, 'Pasta de shader packs'),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    'vanilla-shaders': {
      title: 'Shaders vanilla (sem mods)',
      short: 'Shaders vanilla',
      howto: { name: 'Como instalar um shader pack vanilla (sem mods) no Minecraft Java', steps: VANILLA_SHADER_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Eles funcionam no jogo normal porque são um ', strong('pacote de recursos'), ' que substitui alguns dos arquivos de shader do próprio Minecraft.'),
        steps(VANILLA_SHADER_STEPS),
        callout('warn', 'Feito para uma versão exata', 'A Mojang muda os arquivos de shader com frequência, então um shader pack vanilla só funciona na versão para a qual foi feito. Depois de atualizar o Minecraft, abra o projeto, escolha a versão nova e exporte de novo.'),
      ],
    },
    'vibrant-visuals': {
      title: 'Visuais Vibrantes no Bedrock',
      short: 'Visuais Vibrantes',
      howto: { name: 'Como usar um pacote de Visuais Vibrantes no Minecraft Bedrock', steps: VIBRANT_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Os “shaders” do Bedrock são pacotes de configurações dos Visuais Vibrantes (Vibrant Visuals): iluminação, céu, correção de cor, água e neblina.'),
        steps(VIBRANT_STEPS),
        callout(
          'warn',
          'Não consegue escolher Visuais Vibrantes?',
          'O Minecraft só deixa quando todos os packs ativos são compatíveis. Texture packs clássicos (inclusive os que você faz no Texture Pack Maker) desligam essa opção, então desative os outros packs enquanto usa este. Alguns servidores também desligam.',
        ),
        callout(
          'info',
          'Precisa de um aparelho compatível',
          'Os Visuais Vibrantes funcionam em PCs com Windows e DirectX 12, Xbox e PlayStation (no Xbox One e no PS4 começam desligados), iPhone e iPad com chip A12 ou mais novo e muitos aparelhos Android recentes. Não estão disponíveis no Nintendo Switch original, em Chromebooks nem em tablets Fire. ',
          strong('Personalizar neblina clássica'),
          ' também funciona nos outros modos de gráfico.',
        ),
      ],
    },
    folders: {
      title: 'Encontrar sua pasta do Minecraft',
      short: 'Pastas',
      body: [
        el('p', { class: 'guide-intro' }, 'O jeito mais rápido é o botão ', strong('Abrir pasta de pacotes'), ' do Minecraft. Se você precisar do caminho:'),
        el(
          'table',
          { class: 'paths-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'O quê'), el('th', { scope: 'col' }, 'Onde'))),
          el(
            'tbody',
            null,
            el('tr', null, el('th', { scope: 'row' }, 'Java no Windows'), el('td', null, code('%APPDATA%\\.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java no macOS'), el('td', null, code('~/Library/Application Support/minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java no Linux'), el('td', null, code('~/.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Arquivos do jogo (.jar)'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
            el('tr', null, el('th', { scope: 'row' }, 'Bedrock no Windows'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
          ),
        ),
        el('p', { class: 'muted small' }, 'No Windows, cole o caminho na barra de endereço do Explorador de Arquivos ou na janela Executar (Win + R).'),
      ],
    },
  },
  faq: [
    {
      id: 'vanilla-source',
      q: 'De onde vêm as texturas vanilla?',
      a: [
        p(
          'Quando você começa um projeto do Java, seu navegador baixa o arquivo oficial do jogo dessa versão direto dos servidores da Mojang e guarda só as texturas, os modelos e os shaders neste dispositivo. As texturas do Bedrock vêm do repositório oficial da Mojang ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' no GitHub.',
        ),
        p('Nada da Mojang fica guardado no próprio Texture Pack Maker: é um site estático sem servidores próprios.'),
      ],
    },
    {
      id: 'paint-3d',
      q: 'Posso pintar no modelo 3D em vez da textura plana?',
      a: [
        p(
          'Sim. No editor de texturas use o botão ',
          strong('2D / 3D'),
          ' acima da tela de pintura (ou aperte D). Cada face pinta exatamente o pixel que mostra, inclusive faces giradas, camadas como a lateral da grama, estados ligado e desligado, baús e camas. Lápis, borracha, balde, seletor de cor (ou Alt+clique), tamanho do pincel e espelhamento funcionam, e cada textura tem o seu próprio desfazer. Arraste com o botão direito ou com dois dedos para girar o modelo, use a rolagem ou o gesto de pinça para dar zoom, e F, B, L, R e T pulam para uma face.',
        ),
      ],
    },
    {
      id: 'mobs',
      q: 'Posso editar texturas de mobs?',
      a: [
        p(
          'Sim. Escolha ',
          strong('Mobs'),
          ' na lista de texturas (Blocks · Items · Mobs · All) ou abra qualquer textura da pasta entity. O mob aparece em 3D e é pintado como um bloco. Use as opções ao lado (variante, idade, cor da lã, profissão etc.) para chegar a cada textura que ele usa; camadas como a lã da ovelha, os olhos brilhantes e as roupas dos aldeões são pintadas nas próprias texturas. Na lista Parts, clique em uma parte para escondê-la e pintar o que ela cobre, clique duas vezes para ver só essa parte, e use Show all para trazer tudo de volta. Os mobs do Bedrock usam os modelos do próprio Bedrock, e as máscaras de tonalidade escondidas nos pixels transparentes são mantidas.',
        ),
      ],
    },
    {
      id: 'gear',
      q: 'Posso editar selas, armaduras e armaduras de cavalo?',
      a: [
        p(
          'Sim. Mobs que podem usar itens mostram um grupo ',
          strong('Wearing'),
          ' nas opções: coloque uma sela no porco, no marchador, no cavalo, no camelo ou no náutilo; vista zumbis, esqueletos, piglins e o suporte de armaduras com armadura (escolha um material para o conjunto e depois ligue ou desligue peças, e tinja o couro com ',
          strong('Dye'),
          '); dê armadura a cavalos, lobos e náutilos, um tapete às lhamas e um arreio ao ghast feliz. Cada item usado é pintado na própria textura e tem a sua entrada em ',
          strong('Parts'),
          ', então dá para escondê-lo e pintar o mob por baixo. Ao abrir uma textura de armadura, sela ou tapete, ela aparece sendo usada, e ',
          strong('Used by'),
          ' lista cada mob que a usa. Versões antigas usam as texturas de armadura e sela que tinham na época.',
        ),
        p(
          strong('Acabamentos de armadura: '),
          'com armadura humanoide equipada, escolha um padrão em ',
          strong('Trim'),
          ' e um ',
          strong('Material'),
          ' em Wearing (Java 1.20 e mais novos, e Bedrock). O jogo pinta o padrão cinza com a paleta do material, e usa uma paleta mais escura quando o acabamento é do mesmo material da armadura, como um acabamento de ferro em armadura de ferro. Pinte o acabamento no modelo ou abra o padrão dele: os oito tons de cinza pegam a cor do acabamento e qualquer outra cor fica do jeito que você pintar. Edite a paleta de um material para mudar a cor dele em todos os acabamentos, e esconda ',
          strong('Trim'),
          ' em Parts para chegar à armadura por baixo.',
        ),
      ],
    },
    {
      id: 'models',
      q: 'Posso mudar a forma de blocos e itens, como uma espada 3D?',
      a: [
        p(
          'Sim, em packs do Java (Minecraft 1.8 ou mais novo). Mostre um bloco ou item na prévia e toque em ',
          strong('Editar forma'),
          '. O editor de modelos abre o modelo que o jogo usa, montado a partir dos modelos pais. Adicione, copie e apague cubos, digite posição e tamanho ou arraste as setas e as alças em 3D, com encaixe na grade de 16 × 16 ou mais fina, e gire um cubo em um eixo (em passos de 22,5° antes do Minecraft 1.21.6). Em ',
          strong('Faces'),
          ', dê a cada face uma textura do seu pack, ou uma nova para pintar depois, e arraste a parte da textura que ela mostra; defina também a rotação, quando ela some e se ela é tingida. ',
          strong('Exibição'),
          ' define como o modelo aparece no inventário, em primeira e terceira pessoa, no chão, na moldura e na cabeça, cada um com prévia. Toda mudança pode ser desfeita.',
        ),
        p(
          'Para começar, use o modelo do jogo, um vazio, um cubo inteiro, uma laje, uma cruz como as flores ou, nos itens, ',
          strong('Item 3D a partir do sprite'),
          ', que transforma a imagem plana em cubos de 1 pixel de espessura, juntados no menor número possível. A partir do 1.21.4, ',
          strong('Plano no inventário'),
          ' mantém o ícone plano no inventário e mostra o modelo 3D na mão. O pack recebe o arquivo do modelo e só ganha uma definição de item ou um estado de bloco quando o jogo precisa; a exportação confere os modelos para a sua versão, e os arquivos de modelo dos packs que você abre são mantidos e podem ser editados. No Bedrock, novas formas de bloco exigem um complemento e itens 3D na mão exigem arquivos attachable, que o editor não cria; você pode baixar um modelo como geometria do Bedrock como ponto de partida. Passo a passo: ',
          link('/guides/make-3d-items-texture-pack', 'Como fazer itens 3D'),
          '.',
        ),
      ],
    },
    {
      id: 'pvp',
      q: 'Posso fazer um pack de PvP ou de FPS?',
      a: [
        p(
          'Sim. Ao criar um pack, escolha ', strong('Pack de PvP / FPS'), ': o editor liga o fogo baixo, o vidro e os painéis transparentes, sem borda de abóbora, uma mira menor, espadas menores e um escudo mais baixo, conforme a sua versão tiver. A aba ', strong('PvP'), ' tem um interruptor para cada coisa, com opções como a altura do fogo, cinco miras ou uma desenhada por você e o tamanho da espada, além de opções de FPS: texturas 8× e sem animações. Cada ajuste grava arquivos normais do pack para a sua versão (do Java 1.6.1 ao 26.3, com os nomes de arquivo do 1.8.9) e pode ser desligado ou desfeito. No Bedrock funcionam o vidro transparente, a abóbora, a mira e as texturas 8×; lá um pack não consegue mudar o fogo nem os itens na mão. Zoom, contador de FPS ou tirar a névoa precisam de mods. Passo a passo: ',
          link('/guides/make-a-pvp-texture-pack', 'Como fazer um texture pack de PvP'),
          '.',
        ),
      ],
    },
    {
      id: 'sounds',
      q: 'Posso mudar os sons do meu pack?',
      a: [
        p('Sim. No editor de texture packs, aperte a nota musical no fim do seletor Blocks · Items · Mobs · All. Procure um som pelo nome ou categoria e aperte play para ouvir. Abra o som e use ', strong('Replace'), ' para trocar um arquivo pelo seu próprio áudio (MP3, WAV, OGG, M4A e outros) ou grave um com o microfone. Arraste as alças na forma de onda para cortar, ajuste o volume ou aperte ', strong('Normalise'), ', e use Reset para voltar ao som do jogo. Os sons substituídos são salvos em Ogg Vorbis e exportados com o pack: no Java vão para ', code('assets/minecraft/sounds'), ' e no Bedrock para ', code('sounds/'), ' com as entradas em ', code('sound_definitions.json'), '.'),
        p('A gravação só pede acesso ao microfone quando você aperta Start; se estiver bloqueado, libere para este site pelo ícone na barra de endereço. As gravações nunca saem do seu aparelho. Deixe a maioria dos sons em mono para que venham de onde acontecem no mundo, e use estéreo para música e sons de menu. Os sons do Java tocam direto dos servidores da Mojang, que não deixam sites lerem o áudio, então você pode ouvi-los, mas só corta os sons que enviar ou gravar. A edição de sons funciona no Java 1.7.10 ou mais novo e no Bedrock.'),
      ],
    },
    {
      id: 'hd-skins',
      q: 'Posso fazer uma skin HD de 128×128?',
      a: [
        p('Sim, para a Bedrock Edition. Skins HD têm o dobro de pixels de uma skin normal (128×128 em vez de 64×64), então rostos, sombras e estampas ficam mais finos. Ao começar uma skin no editor de skins, escolha ', strong('HD 128×128'), ' em ', strong('Tamanho'), ', ou mude uma skin existente no editor com ', strong('Tamanho'), ' › ', strong('HD 128'), ': cada pixel é duplicado, então ela fica igual até você adicionar detalhes. Exporte ', strong('Skin para Bedrock (.png)'), ' para importar no Vestiário, ou um ', strong('Pacote de skins do Bedrock (.mcpack)'), '. Um pacote de skins pode misturar skins normais e HD.'),
        p('A Java Edition só aceita skins de 64×64 sem mods, então a exportação para Java cria uma cópia de 64×64 (cada bloco de 2×2 vira um pixel) e mantém seu original HD. Com um mod de skins HD como o CustomSkinLoader, escolha ', strong('128×128 para mods'), '. Consoles não importam arquivos de skin, e tamanhos acima de 128×128 não são suportados. Skins HD também funcionam no criador de totens.'),
      ],
    },
    {
      id: 'upload',
      q: 'Alguma coisa é enviada?',
      a: [p('Não. Seus projetos, imagens e packs exportados nunca saem do seu dispositivo. O app só baixa coisas: arquivos do jogo da Mojang, a lista de versões e as skins que você procura pelo nome de usuário.')],
    },
    {
      id: 'offline',
      q: 'Funciona offline?',
      a: [p('Sim, depois do primeiro carregamento. O app e cada versão que você já abriu ficam neste dispositivo, então dá para continuar editando sem internet. Uma versão que você ainda não usou precisa de conexão, ou escolha ', strong('Use my own .jar'), ' e pegue a versão na sua pasta ', code('.minecraft/versions'), '.')],
    },
    {
      id: 'storage',
      q: 'Onde meus projetos ficam salvos?',
      a: [p('No armazenamento do seu navegador neste dispositivo. Eles ficam lá até você apagar ou limpar os dados deste site. Para fazer backup de um projeto ou levá-lo para outro computador, exporte e abra o arquivo lá com ', strong('Abrir um pack'), '.')],
    },
    {
      id: 'versions',
      q: 'Quais versões do Minecraft são compatíveis?',
      a: [p(`O Java ${LATEST} é o padrão, e todas as versões do Java até a 1.6.1 (quando os pacotes de recursos chegaram) funcionam, inclusive snapshots se você ativar. No Bedrock você pode usar a última versão, a última prévia e versões anteriores.`)],
    },
    {
      id: 'pack-format',
      q: `Qual é o formato de pacote de recursos do Minecraft Java ${LATEST}?`,
      a: [
        p(
          `O Java ${LATEST} usa o formato de pacote de recursos ${F(LATEST)}. Um pack feito só para a ${LATEST} declara `,
          code(`"min_format": ${minFormat(LATEST)}`),
          ' e ',
          code(`"max_format": ${maxFormat(LATEST)}`),
          ' no seu ',
          code('pack.mcmeta'),
          '. O Texture Pack Maker escreve esses campos para você. Veja ',
          link('/guides/minecraft-pack-format-versions', 'o formato de cada versão do Java'),
          '.',
        ),
      ],
    },
    {
      id: 'java-vs-bedrock',
      q: 'Qual é a diferença entre packs do Java e do Bedrock?',
      a: [
        p(
          'Um pack do Java é um ',
          code('.zip'),
          ' com um arquivo ',
          code('pack.mcmeta'),
          ' e texturas PNG em ',
          code('assets/minecraft/textures/'),
          '. Um pack do Bedrock é um ',
          code('.mcpack'),
          ' com um ',
          code('manifest.json'),
          ' e texturas em ',
          code('textures/'),
          ' (PNG ou TGA). Nenhuma edição carrega os packs da outra. ',
          link('/guides/java-vs-bedrock-packs', 'Comparação completa'),
          '.',
        ),
      ],
    },
    {
      id: 'no-mods',
      q: 'Posso fazer shaders sem mods?',
      a: [
        p(
          `Sim. No Java 1.17 e mais novos, um pacote de recursos pode mudar os shaders do próprio Minecraft (cor, vinheta, neblina e bloom na ${LATEST}). No Bedrock, um pacote de Visuais Vibrantes muda a iluminação, o céu, a neblina e a água do jogo. Sombras e reflexos de verdade no Java ainda precisam de Iris ou OptiFine. `,
          link('/guides/make-shaders-without-mods', 'Como funciona'),
          '.',
        ),
      ],
    },
    {
      id: 'phone',
      q: 'Posso usar no celular ou tablet?',
      a: [p('Sim. Todas as ferramentas funcionam com toque, inclusive o zoom com dois dedos nos editores de pixels. Para pixel art detalhada, uma tela maior é mais confortável.')],
    },
    {
      id: 'official',
      q: 'É grátis? É oficial?',
      a: [p('É grátis e de código aberto sob a licença MIT.'), p('O Texture Pack Maker não é um produto oficial do Minecraft e não é aprovado pela Mojang ou pela Microsoft nem tem vínculo com elas.')],
    },
    {
      id: 'bug',
      q: 'Algo deu errado. Como eu aviso?',
      a: [p('Abra uma issue no ', ext(`${REPO_URL}/issues`, 'GitHub'), ' com o seu navegador, a versão do jogo e o que você estava fazendo. Capturas de tela ajudam muito.')],
    },
  ],
  quick: { 'java-packs': 'Instalar um texture pack', 'java-skins': 'Mudar sua skin', iris: 'Usar um shader pack', faq: 'Perguntas' },
  toc: {
    title: 'Nesta página',
    textures: 'Texture packs',
    skins: 'Skins',
    shaders: 'Shaders',
    more: 'Mais',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'Vanilla (sem mods)',
    vibrant: 'Visuais Vibrantes',
    folders: 'Pastas',
    faq: 'Perguntas frequentes',
    allGuides: 'Todos os guias',
  },
  bothEditions: 'Java e Bedrock',
  eyebrow: 'Guia de instalação e ajuda',
  title: 'Como instalar texture packs, skins e shaders',
  lead: 'Leve suas criações para o Minecraft: guias passo a passo para Java e Bedrock no PC, Mac, celular e console, e respostas para as dúvidas mais comuns.',
  faqTitle: 'Perguntas frequentes',
};
