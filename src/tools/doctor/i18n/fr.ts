// French text of Pack Doctor (English sources: ./text.ts, ./report.ts). Pack Doctor keeps its name.
// The game's own words come from its French files: « Conçu pour une ancienne version », Options... ›
// Packs de ressources..., Paramètres › Ressources globales, Vestiaire.

import type { DoctorLanguage } from './load';

const FR: DoctorLanguage = {
  doctor: {
    hero: {
      eyebrow: 'Pack Doctor',
      title: 'Répare un {pack} Minecraft cassé',
      pack: 'pack de textures',
      lead: 'Dépose un pack qui ne marche pas. Pack Doctor trouve ce qui le casse, explique chaque problème, corrige ce qu’il peut corriger sans risque et te donne le pack réparé. Tout se passe dans ton navigateur : rien n’est envoyé.',
      broken: 'Cassé',
      fixed: 'Réparé',
    },
    step1: {
      title: 'Ton pack',
      text: 'Le .zip, .mcpack ou .mcaddon qui ne marche pas, ou son dossier.',
      drop: 'Dépose ton pack ici ou clique pour parcourir',
      dropHint: '.zip · .mcpack · .mcaddon · ou un dossier',
      folder: 'Choisir un dossier',
      reading: 'Lecture du pack…',
      change: 'En vérifier un autre',
      changeTitle: 'Vérifier un autre pack',
      untitled: 'Pack sans titre',
      files: '{count, plural, one {# fichier} other {# fichiers}}',
      textures: '{count, plural, one {# texture} other {# textures}}',
      emptyFolder: 'Ce dossier est vide.',
    },
    step2: {
      title: 'Où tu joues',
      text: 'Ce qui casse dépend du jeu, alors choisis le tien.',
      java: 'Java Edition',
      javaDevices: 'PC, Mac et Linux',
      bedrock: 'Bedrock Edition',
      bedrockDevices: 'Téléphones, tablettes, consoles et Windows',
      version: 'Ta version Java',
      hint: 'Vérifié pour {target}. Change-la pour vérifier à nouveau.',
      hintNone: 'Ajoute un pack et il est vérifié tout de suite.',
      reset: 'Les corrections faites pour l’ancien choix ont été annulées.',
    },
  },
  'doctor.report': {
    progress: {
      title: 'Vérification de ton pack…',
      inBrowser: 'Tout se passe dans ton navigateur.',
      reading: 'Lecture du pack',
      gameFiles: 'Récupération de la liste des fichiers de {target}',
      checking: 'Vérification de chaque fichier',
      fixing: 'Réparation…',
      round: 'Réparation, tour {n}…',
      building: 'Création du pack réparé…',
      cancelled: 'Vérification annulée.',
    },
    head: {
      checkedFor: 'Vérifié pour {target}',
      good: 'Tout a l’air bon',
      goodText: 'Aucun problème trouvé dans ce pack. S’il n’apparaît toujours pas dans le jeu, le guide ci-dessous liste ce qu’il reste à vérifier.',
      problems: '{count, plural, one {# problème trouvé} other {# problèmes trouvés}}',
      fixedTitle: 'Pack réparé prêt',
      fixedGood: 'Tous les problèmes qui pouvaient être corrigés le sont.',
      fixedLeft: '{count, plural, one {Il reste # problème : il a besoin de toi.} other {Il reste # problèmes : ils ont besoin de toi.}}',
      notesOnly: '{count, plural, one {# remarque bonne} other {# remarques bonnes}} à savoir',
    },
    severity: {
      error: 'Ne se charge pas',
      broken: 'En partie cassé',
      warning: 'Attention',
      info: 'Remarque',
    },
    groups: {
      error: 'Empêche le pack de se charger',
      broken: 'Casse une partie du pack',
      warning: 'Peut poser problème',
      info: 'Bon à savoir',
    },
    actions: {
      fixAll: '{count, plural, one {Corriger # problème} other {Corriger les # problèmes}}',
      fixAllHint: 'Applique toutes les corrections sûres, puis vérifie à nouveau le pack.',
      nothingToFix: 'Aucun de ces problèmes ne peut être corrigé automatiquement : regarde les étapes sous chacun.',
      fix: 'Corriger',
      applyAnyway: 'Corriger celui-ci',
      download: 'Télécharger {file}',
      again: 'Vérifier un autre pack',
      undo: 'Annuler les corrections',
      files: '{count, plural, one {# fichier} other {# fichiers}}',
      more: '{count, plural, one {…et # de plus} other {…et # de plus}}',
      safe: 'Correction automatique sûre',
      unsafe: 'Corrige-le seulement si c’est ce que tu veux',
      manual: 'Comment le corriger',
      gameSays: 'Ce que dit le jeu',
      working: 'En cours…',
      failed: 'Impossible de corriger ça : {message}',
    },
    affects: {
      label: 'Concerne',
      all: 'Toutes les versions de {edition}',
      from: '{edition} {from} et plus récent',
      upTo: '{edition} {to} et plus ancien',
      target: '{edition} {version}',
      mobile: 'Bedrock sur Android, iPhone, iPad et consoles',
      some: 'Certains appareils',
    },
    after: {
      title: 'Avant et après',
      before: 'Avant',
      after: 'Après',
      changes: 'Ce qui a changé',
      nothing: 'Rien n’a eu besoin de changer.',
    },
    change: {
      rebuilt: 'Zip propre écrit avec des chemins normaux',
      extracted: 'Pack sorti de « {file} »',
      junk: '{count, plural, one {# fichier inutile laissé de côté} other {# fichiers inutiles laissés de côté}}',
      created: '{file} créé',
      createdMany: '{count, plural, one {# fichier créé} other {# fichiers créés}}',
      rewritten: '{file} réécrit',
      rewrittenMany: '{count, plural, one {# fichier réécrit} other {# fichiers réécrits}}',
      renamed: '{count, plural, one {# fichier renommé} other {# fichiers renommés}}',
      moved: '{count, plural, one {# fichier déplacé} other {# fichiers déplacés}}',
      converted: '{count, plural, one {# image convertie en PNG} other {# images converties en PNG}}',
      uuids: 'Nouveaux UUID donnés au pack',
      refs: '{count, plural, one {Chemins mis à jour dans # fichier} other {Chemins mis à jour dans # fichiers}}',
      extension: 'Enregistré en {ext}',
    },
    checked: {
      title: 'Ce qui a été vérifié',
      zip: 'Le fichier s’ouvre comme un zip',
      layout: 'Le pack est en haut du fichier',
      mcmeta: 'pack.mcmeta est valide',
      format: 'Conçu pour {target}',
      folders: 'Les dossiers et noms de textures correspondent à {target}',
      names: 'Des noms de fichiers que Java accepte',
      images: '{count, plural, one {# image que le jeu peut lire} other {# images que le jeu peut lire}}',
      json: '{count, plural, one {# fichier JSON sans erreur} other {# fichiers JSON sans erreur}}',
      refs: '{count, plural, one {# référence entre fichiers} other {# références entre fichiers}}',
      animations: '{count, plural, one {# texture animée} other {# textures animées}}',
      sounds: '{count, plural, one {# fichier son} other {# fichiers son}}',
      manifest: 'manifest.json est valide',
      uuids: 'Les UUID du pack sont bien à lui',
      textureLists: '{count, plural, one {# chemin dans les listes de textures} other {# chemins dans les listes de textures}}',
      offline: 'La liste des fichiers du jeu n’a pas pu être téléchargée, les chemins vers ses textures et ses modèles n’ont donc pas été vérifiés.',
    },
    download: {
      java: 'Mets le .zip dans ton dossier resourcepacks (Options... › Packs de ressources... › Ouvrir le dossier des packs), puis sélectionne-le. Ne le décompresse pas. ',
      bedrock: 'Ouvre le .mcpack sur ton appareil : Minecraft l’importe. Active-le ensuite dans Paramètres › Ressources globales. ',
      help: 'Installer des packs',
      saved: '{count, plural, one {# fichier} other {# fichiers}}',
      failed: 'Impossible de créer le pack réparé.',
    },
    error: {
      title: 'Impossible de vérifier le pack',
      text: 'Réessaie, ou télécharge à nouveau le pack au cas où le fichier serait endommagé.',
    },
    links: {
      converter: 'Convertisseur de packs',
      install: 'Comment installer des packs',
      shadersHelp: 'Installer des packs de shaders',
      formats: 'Les formats de pack de chaque version',
      textures: 'Éditeur de packs de textures',
      sounds: 'À propos de l’éditeur de sons',
      skins: 'Créateur de packs de skins',
      notWorking: 'Plus de solutions',
      bedrockPacks: 'Installer des packs Bedrock',
    },
    issues: {
      'zip-damaged': {
        title: { rar: 'C’est un fichier RAR, pas un zip', '7z': 'C’est un fichier 7-Zip, pas un zip', other: 'Ce n’est pas un fichier zip', damaged: 'Le zip est endommagé' },
        text: {
          rar: 'Minecraft ne lit que les fichiers zip (.zip pour Java, .mcpack pour Bedrock).',
          '7z': 'Minecraft ne lit que les fichiers zip (.zip pour Java, .mcpack pour Bedrock).',
          other: 'Les packs Minecraft sont des fichiers zip (.zip pour Java, .mcpack pour Bedrock), et ce fichier est autre chose.',
          damaged: 'Le téléchargement a sûrement été coupé, ou le fichier s’est abîmé.',
        },
        steps: 'Télécharge à nouveau le pack là où tu l’as eu. S’il était en .rar ou .7z, décompresse-le d’abord et vérifie le .zip, le .mcpack ou le dossier qu’il contient.',
      },
      'zip-method': {
        title: { encrypted: 'Des fichiers protégés par mot de passe', method: 'Des fichiers compressés d’une façon que Minecraft ne sait pas lire', damaged: 'Des fichiers endommagés dans le zip' },
        text: {
          encrypted: '{count, plural, one {# fichier est protégé} other {# fichiers sont protégés}} par un mot de passe, et Minecraft ne peut pas les ouvrir.',
          method: '{count, plural, one {# fichier a été compressé} other {# fichiers ont été compressés}} avec une méthode comme LZMA, BZip2 ou Deflate64. Minecraft ne lit que les zip Deflate standard.',
          damaged: '{count, plural, one {# fichier ne peut pas être lu} other {# fichiers ne peuvent pas être lus}}. Le téléchargement a peut-être été coupé.',
        },
        steps: 'Décompresse le pack et zippe à nouveau les fichiers avec l’outil zip de ton ordinateur, ou avec 7-Zip réglé sur « Deflate » et sans mot de passe. Puis vérifie le nouveau zip ici.',
      },
      'zip-backslash': {
        title: 'Les chemins des fichiers utilisent des barres obliques inverses',
        text: 'Le zip enregistre des chemins comme assets\\minecraft\\textures au lieu de assets/minecraft/textures. Certains outils zip sur Windows font ça, et Java ne trouve alors plus aucun fichier.',
        fix: 'Le pack réparé est écrit avec des barres obliques normales.',
      },
      zip64: {
        title: 'Le zip utilise le format ZIP64',
        text: 'ZIP64 est fait pour les archives énormes. Certains appareils ne peuvent pas importer un pack Bedrock enregistré comme ça.',
        fix: 'Le pack réparé est écrit comme un zip standard.',
      },
      junk: {
        title: 'Fichiers inutiles de Mac et Windows',
        text: '{count, plural, one {# fichier} other {# fichiers}} comme __MACOSX, .DS_Store ou Thumbs.db se sont ajoutés quand le pack a été zippé. Le jeu n’en a pas besoin, et ils peuvent faire échouer une importation Bedrock.',
        fix: 'Ils sont laissés de côté dans le pack réparé.',
      },
      'nested-folder': {
        title: 'Le pack est dans un dossier en trop',
        text: {
          java: 'Tout est dans « {folder} » au lieu d’être en haut du zip. Java n’affiche un pack que si pack.mcmeta est en haut, celui-ci n’apparaît donc pas.',
          bedrock: 'Tout est dans « {folder} ». manifest.json doit être en haut du .mcpack, sinon certains appareils ne peuvent pas importer le pack.',
        },
        fix: 'Le pack réparé a ses fichiers en haut.',
      },
      'nested-archive': {
        title: 'Le pack est un zip dans le zip',
        text: {
          java: 'Le téléchargement contient « {inner} », qui est le pack lui-même. Java ne regarde pas dans un zip qui est dans un zip.',
          bedrock: 'Le téléchargement contient « {inner} », qui est le pack lui-même. Bedrock a besoin de ce fichier, pas du zip autour.',
        },
        fix: 'Le pack réparé est celui de l’intérieur, sorti du zip.',
      },
      'several-packs': {
        title: 'Ce fichier contient {count} packs',
        text: 'On dirait un lot avec un pack par version ou par édition. Pack Doctor a vérifié « {checked} », celui qui correspond le mieux au jeu choisi, et le téléchargement réparé ne contient que lui.',
      },
      'no-pack': {
        title: 'Aucun pack trouvé',
        text: 'Il n’y a ni pack.mcmeta, ni manifest.json, ni dossier assets, ni dossier textures dans ce fichier : ce n’est donc pas un pack de ressources Minecraft.',
        steps: 'Tu n’as que des textures PNG en vrac ? Le Convertisseur de packs peut en faire un pack. Ou crée un nouveau pack dans l’Éditeur de packs de textures.',
      },
      'shader-pack': {
        title: 'C’est un pack de shaders, pas un pack de ressources',
        text: 'Il a un dossier shaders comme les packs de shaders Iris et OptiFine. Ceux-là ont besoin du mod Iris ou OptiFine et ne vont pas dans le dossier resourcepacks.',
        steps: 'Installe Iris (ou OptiFine), puis mets le zip dans le dossier shaderpacks : Options... › Graphismes... › Packs de shaders... › Ouvrir le dossier des packs de shaders... Ne le décompresse pas.',
      },
      'data-pack': {
        title: 'C’est un pack de données, pas un pack de ressources',
        text: 'Il a un dossier data et pas de dossier assets. Les packs de données changent les recettes, le butin et les mondes, et s’ajoutent à un monde, pas à la liste des packs de ressources.',
        steps: 'Mets le zip dans le dossier datapacks du monde (Créer un nouveau monde › Plus › Packs de données, ou saves/<monde>/datapacks), puis rouvre le monde.',
      },
      'other-bedrock-pack': {
        title: { behavior: 'C’est un pack de comportements', skin: 'C’est un pack de skins', world: 'C’est un modèle de monde' },
        text: {
          behavior: 'Les packs de comportements changent le fonctionnement du jeu (créatures, objets, scripts), pas ses textures : Pack Doctor n’a donc rien à vérifier ici.',
          skin: 'Les packs de skins ajoutent des skins au Vestiaire : Pack Doctor n’a donc rien à vérifier ici. Ouvre le .mcpack pour l’importer.',
          world: 'Les modèles de monde créent de nouveaux mondes : Pack Doctor n’a donc rien à vérifier ici. Ouvre le fichier pour l’importer.',
        },
      },
      'bedrock-zip': {
        title: 'Un pack Bedrock en .zip',
        text: 'Les téléphones, tablettes et consoles n’importent les packs Bedrock qu’à partir de fichiers .mcpack : toucher un .zip n’ouvre pas Minecraft.',
        fix: 'Le pack réparé est enregistré en .mcpack.',
      },
      'java-mcpack': {
        title: 'Un pack Java nommé {ext}',
        text: 'Java n’affiche que les fichiers .zip et les dossiers de son dossier resourcepacks. Un .mcpack est un fichier Bedrock.',
        fix: 'Le pack réparé est enregistré en .zip.',
      },
      'wrong-edition': {
        title: { java: 'C’est un pack Java, et tu joues à Bedrock', bedrock: 'C’est un pack Bedrock, et tu joues à Java' },
        text: {
          java: 'Les packs Java et Bedrock utilisent des fichiers et des dossiers différents, Bedrock ne peut donc pas utiliser ce pack tel quel. Le Convertisseur de packs le transforme en .mcpack Bedrock.',
          bedrock: 'Les packs Java et Bedrock utilisent des fichiers et des dossiers différents, Java ne peut donc pas utiliser ce pack tel quel. Le Convertisseur de packs le transforme en .zip Java pour ta version.',
        },
        steps: 'Convertis-le avec le Convertisseur de packs, ou choisis l’autre édition plus haut si c’est celle à laquelle tu joues.',
      },
      'mcmeta-missing': {
        title: 'pack.mcmeta manque',
        text: 'Chaque pack de ressources Java a besoin d’un fichier pack.mcmeta en haut. Sans lui, le pack n’apparaît pas dans la liste.',
        fix: 'Crée pack.mcmeta pour Java {version}.',
      },
      'mcmeta-name': {
        title: 'pack.mcmeta n’a pas le bon nom',
        text: 'Il s’appelle « {file} ». Windows cache souvent le « .txt » à la fin des noms de fichiers, et un fichier enregistré dans le Bloc-notes devient pack.mcmeta.txt.',
        fix: 'Le renomme en pack.mcmeta.',
      },
      'mcmeta-json': {
        title: 'pack.mcmeta n’est pas du JSON valide',
        text: 'Une virgule, un guillemet ou un crochet qui manque casse le fichier, et Java ignore tout le pack.',
        fix: 'Écrit un nouveau pack.mcmeta pour Java {version}, en gardant la description.',
      },
      'mcmeta-strict': {
        title: { bom: 'pack.mcmeta commence par une marque invisible', comments: 'pack.mcmeta a des commentaires ou des virgules en trop' },
        text: {
          bom: 'Le fichier commence par une indication d’ordre des octets (BOM), que certains éditeurs ajoutent. Le lecteur de Java s’arrête là et ignore le pack.',
          comments: 'Java lit pack.mcmeta de façon stricte : des commentaires, ou une virgule avant un crochet fermant, lui font ignorer le pack.',
        },
        fix: 'L’écrit à nouveau en JSON propre pour Java {version}.',
      },
      'mcmeta-invalid': {
        title: 'Java ne sait pas lire pack.mcmeta',
        text: 'Le fichier est du JSON valide, mais ses champs ne respectent pas les règles de Java {version} : le pack apparaît comme cassé ou n’apparaît pas du tout.',
        fix: 'Écrit pack.mcmeta comme Java {version} l’attend, en gardant la description.',
      },
      'format-mismatch': {
        title: { old: 'Conçu pour une ancienne version', new: 'Conçu pour une version plus récente' },
        text: 'Le pack dit qu’il est pour Java {packVersions} (format de pack {packFormats}), mais Java {version} utilise {format}. Le jeu le marque comme incompatible et demande avant de l’utiliser, et les textures renommées entre les versions ont l’air fausses.',
        fix: 'Met à jour pack.mcmeta pour Java {version}.',
      },
      'old-folders': {
        title: 'Des dossiers de textures d’avant la 1.13',
        text: '{count, plural, one {# texture est} other {# textures sont}} dans textures/blocks ou textures/items. Depuis la 1.13, Java utilise textures/block et textures/item, et beaucoup de fichiers ont changé de nom : Java {version} les ignore donc.',
        fix: 'Les renomme pour Java {version} et met à jour les modèles qui les utilisent.',
        steps: 'Ouvre le pack dans le Convertisseur de packs et convertis-le en Java {version}.',
      },
      'new-folders': {
        title: 'Des dossiers de textures de la 1.13 et plus récent',
        text: '{count, plural, one {# texture est} other {# textures sont}} dans textures/block ou textures/item, mais Java {version} utilise encore textures/blocks et textures/items : il les ignore donc.',
        fix: 'Les renomme pour Java {version}.',
        steps: 'Ouvre le pack dans le Convertisseur de packs et convertis-le en Java {version}.',
      },
      'renamed-textures': {
        title: 'Des textures avec d’anciens noms',
        text: '{count, plural, one {# texture a} other {# textures ont}} le nom utilisé dans Java {from}. Java {version} utilise un autre nom, la texture est donc ignorée.',
        fix: 'Les renomme pour Java {version} et met à jour les modèles qui les utilisent.',
      },
      'bad-names': {
        title: 'Des noms de fichiers que Java ne peut pas utiliser',
        text: '{count, plural, one {# fichier a} other {# fichiers ont}} des majuscules, des espaces ou d’autres caractères dans leur chemin. Java n’accepte que a–z, 0–9, _ - . et / dans les noms de fichiers, et ignore le reste.',
        fix: 'Les renomme en minuscules, avec _ à la place des espaces, et met à jour les fichiers qui pointent vers eux.',
        steps: 'Renomme à la main les fichiers qui restent : en minuscules, sans espaces.',
      },
      'misplaced-textures': {
        title: 'Des textures dans le mauvais dossier',
        text: '{count, plural, one {# texture est} other {# textures sont}} en dehors de assets/minecraft/textures, là où Java les cherche.',
        fix: 'Les déplace dans assets/minecraft/textures.',
      },
      'atlas-missing': {
        title: 'Des textures de modèles en dehors de l’atlas des blocs',
        text: 'Depuis la 1.19.3, les modèles ne peuvent utiliser que des textures de dossiers présents dans l’atlas du jeu, comme block et item. {count, plural, one {# texture} other {# textures}} dans {folders} apparaissent en violet et noir.',
        fix: 'Ajoute ces dossiers aux fichiers d’atlas du pack.',
      },
      'missing-texture-ref': {
        title: 'Des modèles pointent vers des textures qui n’existent pas',
        text: '{count, plural, one {# chemin de texture n’est} other {# chemins de textures ne sont}} ni dans le pack ni dans Java {version} : la texture manquante violette et noire s’affiche à la place.',
        fix: 'Fait pointer les anciens noms de textures vers leurs noms dans Java {version}.',
        steps: 'Vérifie l’orthographe et le dossier de chaque chemin, ou ajoute les images qui manquent.',
      },
      'missing-model-ref': {
        title: 'Des modèles qui n’existent pas',
        text: '{count, plural, one {# référence pointe} other {# références pointent}} vers un modèle qui n’est ni dans le pack ni dans Java {version} : le bloc ou l’objet devient un cube violet et noir.',
        steps: 'Vérifie l’orthographe de chaque nom de modèle, ou ajoute les fichiers de modèles qui manquent.',
      },
      'anim-strip': {
        title: 'Des textures animées sans leur .mcmeta',
        text: '{count, plural, one {# texture est} other {# textures sont}} une longue bande d’images sans .png.mcmeta à côté : Java écrase donc toute la bande sur une seule face.',
        fix: 'Ajoute un .png.mcmeta qui joue les images. Ne fais ça que si la texture est censée bouger.',
      },
      'anim-size': {
        title: 'Les images de l’animation ne collent pas à la taille',
        text: '{count, plural, one {# texture animée a} other {# textures animées ont}} une taille qui ne fait pas un nombre entier d’images. Java ne peut pas la découper et affiche la texture manquante.',
        steps: 'Fais en sorte que la hauteur de l’image soit un multiple de sa largeur, ou de la taille d’image réglée dans le .mcmeta.',
      },
      'anim-frames': {
        title: 'Des réglages d’animation qui ne marchent pas',
        text: '{count, plural, one {# fichier .mcmeta liste} other {# fichiers .mcmeta listent}} des images que l’image n’a pas, ou une durée d’image inférieure à 1.',
        fix: 'Retire les images qui manquent et met les durées d’image à 1 au moins.',
      },
      'sound-format': {
        title: 'Des sons qui ne sont pas en Ogg Vorbis',
        text: '{count, plural, one {# fichier son est} other {# fichiers son sont}} en MP3, WAV ou un autre format, parfois juste renommé en .ogg. Java ne joue que de vrais fichiers Ogg Vorbis.',
        steps: 'Convertis-les en .ogg, par exemple avec l’éditeur de sons de l’Éditeur de packs de textures, qui importe de l’audio et enregistre en Ogg Vorbis.',
      },
      'overlay-missing': {
        title: 'Des dossiers d’overlay absents',
        text: 'pack.mcmeta liste {count, plural, one {# dossier d’overlay qui n’est pas} other {# dossiers d’overlay qui ne sont pas}} dans le pack. Rien ne casse, mais ces versions n’ont pas d’overlay.',
        steps: 'Retire ces entrées de overlays dans pack.mcmeta, ou ajoute les dossiers.',
      },
      'core-shaders': {
        title: 'Des shaders du cœur du jeu pour une seule version',
        text: 'Le pack remplace les shaders du jeu lui-même ({count, plural, one {# fichier} other {# fichiers}}). Mojang change souvent ces fichiers : ils ne marchent que dans la version pour laquelle ils ont été écrits ; dans une autre, Java peut désactiver tous les packs de ressources.',
        steps: 'Utilise le pack dans la version pour laquelle il a été conçu, ou crée un nouveau shader pour ta version dans le Créateur de shaders.',
      },
      optifine: {
        title: 'Des parties qui ont besoin d’OptiFine',
        text: '{count, plural, one {# fichier est} other {# fichiers sont}} dans le dossier optifine : textures connectées, textures d’objets personnalisées ou ciels. Sans OptiFine (ou un mod qui lit ces fichiers), le jeu les ignore ; le reste du pack marche quand même.',
      },
      'json-strict': {
        title: 'Du JSON avec des commentaires ou des virgules en trop',
        text: '{count, plural, one {# fichier a} other {# fichiers ont}} des commentaires, une virgule avant un crochet fermant ou une marque invisible au début. Le lecteur strict de Java peut refuser ces fichiers.',
        fix: 'Les écrit à nouveau en JSON propre.',
      },
      'json-syntax': {
        title: 'Des fichiers JSON avec des erreurs',
        text: '{count, plural, one {# fichier a} other {# fichiers ont}} une erreur de syntaxe, comme une virgule, un guillemet ou un crochet qui manque. Le jeu ignore le fichier : des modèles disparaissent, des sons et des textes sont laissés de côté.',
        steps: 'Ouvre le fichier dans un éditeur de texte, corrige la ligne indiquée et vérifie à nouveau.',
      },
      'manifest-missing': {
        title: 'manifest.json manque',
        text: 'Chaque pack Bedrock a besoin d’un manifest.json en haut avec son nom, deux identifiants (UUID) et une version. Sans lui, l’importation échoue.',
        fix: 'Crée un manifest.json avec de nouveaux identifiants.',
      },
      'manifest-name': {
        title: 'manifest.json n’a pas le bon nom',
        text: 'Il s’appelle « {file} ». Bedrock ne lit que manifest.json, tout en minuscules, sans « .txt ».',
        fix: 'Le renomme en manifest.json.',
      },
      'manifest-json': {
        title: 'manifest.json n’est pas du JSON valide',
        text: 'Une virgule, un guillemet ou un crochet qui manque casse le fichier, et l’importation échoue.',
        fix: 'Écrit un nouveau manifest.json, en gardant le nom, la description et les identifiants qu’il peut encore lire.',
      },
      'manifest-format': {
        title: 'format_version inconnu',
        text: 'manifest.json indique format_version {value}. Bedrock comprend 1, 2 et 3.',
        fix: 'Met format_version à 2 et répare le reste du fichier.',
      },
      'manifest-header': {
        title: { missing: 'Le manifeste n’a pas d’en-tête', version: 'La version du pack n’est pas valide', name: 'Le pack n’a pas de nom' },
        text: {
          missing: 'L’en-tête contient le nom, l’identifiant et la version du pack. Sans lui, Bedrock ne peut pas importer le pack.',
          version: 'header.version doit être trois nombres entiers, comme [1, 0, 0].',
          name: 'Bedrock a besoin d’un nom pour afficher le pack dans sa liste.',
        },
        fix: 'Répare manifest.json, en gardant tout ce qui est valide.',
      },
      'manifest-uuid': {
        title: { invalid: 'Des UUID manquants ou pas valides', same: 'L’en-tête et le module partagent un UUID' },
        text: {
          invalid: 'Un pack a besoin de deux identifiants uniques (UUID), un dans l’en-tête et un dans le module, écrits comme 8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11.',
          same: 'Les deux identifiants doivent être différents, sinon Bedrock refuse le pack.',
        },
        fix: 'Ajoute de nouveaux UUID là où ils manquent ou se répètent.',
      },
      'manifest-modules': {
        title: 'Pas de module « resources »',
        text: 'Bedrock reconnaît un pack de ressources à un module de type "resources". Celui-ci a : {found}.',
        fix: 'Met le type du module à "resources".',
      },
      'manifest-engine': {
        title: { missing: 'Pas de min_engine_version', invalid: 'min_engine_version n’est pas valide', new: 'A besoin d’un Minecraft qui n’existe pas encore' },
        text: {
          missing: 'Sans lui, Bedrock considère que le pack est fait pour de très anciennes versions et peut lire certains de ses fichiers à l’ancienne.',
          invalid: 'Il doit être trois nombres, comme [1, 21, 0].',
          new: 'min_engine_version vaut {value}, plus récent que toutes les versions sorties (la plus récente est {newest}) : Bedrock dit donc que le pack a besoin d’un jeu plus récent.',
        },
        fix: 'Met min_engine_version à {engine}.',
      },
      'duplicate-uuid': {
        title: 'Deux packs avec le même UUID',
        text: '{count} packs de ce fichier ont le même identifiant, comme un pack copié puis modifié. Bedrock les voit comme un seul pack : un seul apparaît, ou l’un remplace l’autre.',
        fix: 'Donne de nouveaux UUID à ce pack.',
      },
      'known-uuid': {
        title: 'Même UUID qu’un autre pack que tu as vérifié',
        text: 'Ce pack a le même identifiant que « {other} », que tu as vérifié plus tôt sur cet appareil. Si les deux sont installés, Bedrock les traite comme un seul pack et n’en garde qu’un.',
        fix: 'Donne de nouveaux UUID à ce pack. Les mondes qui utilisent l’ancienne copie doivent alors l’ajouter à nouveau.',
      },
      'texture-list': {
        title: 'Des listes de textures que Bedrock ne sait pas lire',
        text: '{count, plural, one {# liste de textures n’a} other {# listes de textures n’ont}} pas de section texture_data, ou des entrées de la mauvaise forme. Les textures qu’elles listent apparaissent comme manquantes.',
        steps: 'Compare le fichier avec le même fichier dans le pack de ressources de Minecraft lui-même et corrige sa structure.',
      },
      'bedrock-missing-ref': {
        title: 'Des listes de textures pointent vers des images absentes',
        text: '{count, plural, one {# chemin pointe} other {# chemins pointent}} vers une image qui n’est ni dans le pack ni dans les textures de Bedrock : ces blocs ou objets ont l’air manquants.',
        steps: 'Vérifie chaque chemin (sans l’extension du fichier, par ex. textures/blocks/stone) ou ajoute les images.',
      },
      'bedrock-case': {
        title: { files: 'Des noms de fichiers avec de mauvaises majuscules', refs: 'Des chemins avec de mauvaises majuscules' },
        text: {
          files: '{count, plural, one {# fichier ne diffère} other {# fichiers ne diffèrent}} des noms du jeu que par les majuscules. Windows s’en fiche, mais Android, iPhone, iPad et les consoles cherchent le nom exact : la texture n’y est donc pas remplacée.',
          refs: '{count, plural, one {# chemin} other {# chemins}} des listes de textures ne correspondent à une image qu’avec des majuscules différentes. Ça marche sur Windows, pas sur les téléphones, tablettes et consoles.',
        },
        fix: { files: 'Renomme les fichiers comme le jeu les écrit.', refs: 'Change les chemins pour les noms exacts des images.' },
      },
      'java-in-bedrock': {
        title: 'Des textures Java dans un pack Bedrock',
        text: '{count, plural, one {# texture est} other {# textures sont}} dans assets/minecraft/textures, le dossier de Java. Bedrock ne lit que textures/ et les ignore.',
        steps: 'Convertis les textures Java avec le Convertisseur de packs, puis ajoute-les à ce pack.',
      },
      'tga-png-pair': {
        title: 'Des textures en .png et en .tga',
        text: '{count, plural, one {# texture existe} other {# textures existent}} deux fois, en .png et en .tga. Le jeu n’en utilise qu’une, ton changement peut donc ne pas se voir.',
        steps: 'Garde un seul fichier par texture (du même type que celui du jeu) et supprime l’autre.',
      },
      'subpack-missing': {
        title: 'Des dossiers de sous-packs manquent',
        text: 'manifest.json liste {count, plural, one {# sous-pack dont le dossier n’est pas} other {# sous-packs dont les dossiers ne sont pas}} dans subpacks/ : le choisir dans les paramètres du pack ne fait donc rien.',
        steps: 'Ajoute les dossiers, ou retire ces entrées de subpacks dans manifest.json.',
      },
      'pack-name-key': {
        title: 'Le nom du pack est une clé de langue',
        text: 'Le nom est « {key} », une clé à chercher dans texts/en_US.lang, mais le pack ne la définit pas : Bedrock affiche donc la clé elle-même.',
        fix: 'Nomme le pack « {name} » dans manifest.json.',
      },
      'long-paths': {
        title: 'Des chemins de fichiers très longs',
        text: '{count, plural, one {# chemin fait} other {# chemins font}} plus de 80 caractères. La Xbox et d’autres appareils ne peuvent pas charger ces fichiers (80 est aussi la limite de Microsoft pour les packs du Marketplace).',
        steps: 'Raccourcis les noms des dossiers et des fichiers.',
      },
      'material-bin': {
        title: 'Des fichiers de shaders qui ont besoin d’un jeu modifié',
        text: '{count, plural, one {# fichier .material.bin remplace} other {# fichiers .material.bin remplacent}} les shaders RenderDragon de Bedrock. Ils ne marchent qu’avec des outils comme BetterRenderDragon ou un jeu modifié, et cassent à chaque mise à jour.',
      },
      'not-png': {
        title: 'Des images qui ne sont pas vraiment des PNG',
        text: '{count, plural, one {# fichier est nommé} other {# fichiers sont nommés}} .png mais contiennent une image JPEG, WebP, GIF, BMP ou TGA. Le jeu n’y lit que de vrais fichiers PNG et affiche la texture manquante.',
        fix: 'Les convertit en vrais PNG.',
      },
      'wrong-image-type': {
        title: 'Des images dans un format que le jeu ne lit pas',
        text: {
          java: '{count, plural, one {# texture est} other {# textures sont}} en .jpg, .webp, .gif, .bmp ou .tga. Java ne lit que les textures .png.',
          bedrock: '{count, plural, one {# texture est} other {# textures sont}} en .webp, .gif ou .bmp. Bedrock lit le .png et le .tga.',
        },
        fix: 'Les convertit en .png avec le même nom.',
      },
      'broken-image': {
        title: 'Des images endommagées',
        text: '{count, plural, one {# image est coupée} other {# images sont coupées}} ou endommagées et ne peuvent pas être lues.',
        steps: 'Ouvre chacune dans un éditeur d’images et enregistre-la à nouveau en PNG, ou remplace-la.',
      },
      'png-format': {
        title: 'Des PNG 16 bits ou entrelacés',
        text: '{count, plural, one {# image est enregistrée} other {# images sont enregistrées}} en 16 bits par canal ou en entrelacé. Le jeu n’a besoin que d’images 8 bits standard, et certaines versions et certains appareils les affichent mal.',
        fix: 'Les enregistre en PNG RGBA 8 bits standard. Les pixels restent les mêmes.',
      },
      'not-power-of-two': {
        title: 'Des tailles qui ne sont pas des puissances de deux',
        text: '{count, plural, one {# texture de bloc ou d’objet ne fait pas} other {# textures de blocs et d’objets ne font pas}} 16, 32, 64, 128… pixels de large. Le jeu peut baisser la qualité des blocs lointains (mipmaps) pour tout le pack, ou afficher ces textures floues.',
        steps: 'Redimensionne-les à une puissance de deux, comme 16×16 ou 32×32, avec la mise à l’échelle « plus proche voisin ».',
      },
      'pack-icon': {
        title: '{file} n’est pas un PNG qui marche',
        text: 'L’icône du pack est dans un autre format ou endommagée : le pack s’affiche donc sans son image.',
        fix: 'La convertit en PNG.',
        steps: 'Enregistre l’icône en PNG carré, par exemple 128×128.',
      },
    },
  },
};

/** Rightly the same as in English (the name of the tool; "texture" is a French word too). */
export const SAME_AS_ENGLISH = ['doctor:hero.eyebrow', 'doctor:step1.textures'];

export default FR;
