import type { Dictionary } from '@/lib/i18n/dictionaries/en'

export const fr: Dictionary = {
  locale: {
    label: 'Langue',
    switchTo: 'Changer de langue',
  },
  common: {
    usdt: 'USDT',
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    close: 'Fermer',
    copy: 'Copier',
    copied: 'Copié',
    none: 'Aucun',
    dash: '—',
    all: 'Tout',
    date: 'Date',
    type: 'Type',
    amount: 'Montant',
    status: 'Statut',
    details: 'Détails',
    member: 'Membre',
    active: 'Actif',
    inactive: 'Inactif',
    previous: 'Précédent',
    next: 'Suivant',
    pageOf: (page: number, total: number) => `Page ${page} sur ${total}`,
    signOut: 'Se déconnecter',
    viewAll: 'Tout afficher',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    unread: 'Non lu',
  },

  nav: {
    dashboard: 'Tableau de bord',
    tasks: 'Tâches',
    vip: 'Niveaux VIP',
    wallet: 'Portefeuille',
    team: 'Équipe',
    history: 'Historique',
    deposit: 'Dépôt',
    withdraw: 'Retrait',
    notifications: 'Notifications',
    profile: 'Profil',
    supportTelegram: 'Assistance Telegram',
    admin: 'Administration',
    sectionAccount: 'Compte',
    sectionOperations: 'Opérations',
    home: 'Accueil',
    currentTier: 'Niveau actuel',
    noActivePlan: 'Aucun forfait actif',
    activatePrompt: 'Activez-en un pour gagner des récompenses →',
    tasksPerDay: (n: number) => `${n} tâches / jour`,
    activated: (amount: string) => `${amount} activé`,
    notificationsAria: (unread: number) =>
      unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications',
    statusStrip: 'Session active — registre interne de la plateforme',
    statusStripRight: 'Montants en USDT · réinitialisation à 00:00 UTC',
  },

  publicSite: {
    howItWorks: 'Fonctionnement',
    terms: 'Conditions',
    privacy: 'Confidentialité',
    termsOfService: 'Conditions d’utilisation',
    privacyPolicy: 'Politique de confidentialité',
    supportTelegram: 'Assistance sur Telegram',
    signIn: 'Se connecter',
    register: 'S’inscrire',
    footerBlurb:
      'Une plateforme sur invitation uniquement proposant des exercices d’analyse du marché des cryptomonnaies et des récompenses de la plateforme.',
    disclaimer:
      'ArbiFlow n’est ni une banque, ni un courtier, ni un dépositaire, ni un établissement financier agréé, et elle n’est supervisée par aucun régulateur financier. La plateforme n’exécute pas de transactions d’arbitrage, ne fournit pas de conseils en investissement, ne propose aucun produit d’investissement et ne promet aucun profit ni rendement. Les récompenses des tâches sont des paiements configurables de la plateforme pour les exercices d’analyse de marché terminés, et non des revenus issus du trading. Les actifs numériques sont volatils et les transferts sur les blockchains publiques sont irréversibles. Ne participez qu’avec des fonds que vous pouvez vous permettre de perdre.',
  },

  home: {
    badge: 'Analyse du marché des cryptomonnaies',
    headlineTop: 'Lisez l’écart de prix.',
    headlineAccent: 'Comprenez le risque.',
    intro:
      'Les membres réalisent de courts exercices de recherche sur l’arbitrage des cryptomonnaies : ils comparent des scénarios de marché, estiment les écarts après frais et évaluent les risques liés à la liquidité et à la volatilité. Les exercices terminés peuvent donner droit à une récompense configurable de la plateforme, enregistrée dans un registre interne.',
    ctaPrimary: 'Créer mon compte',
    ctaSecondary: 'Découvrir le fonctionnement',
    inviteNote: 'Vous avez besoin d’un code d’invitation d’un membre existant. Les inscriptions libres ne sont pas ouvertes.',
    figureTasks: 'Tâches par jour',
    figureWindow: 'Par analyse',
    figureTasksValue: '3',
    figureWindowValue: '180 s',
    figureChecks: 'Vérifications des dépôts',
    figureChecksValue: 'Sur la blockchain',
    plateHint: 'PAIRE · ÉCART · FRAIS',
    checklistTitle: 'Analyse du marché',
    checklist: [
      'Comparer le même actif sur plusieurs marchés',
      'Estimer l’écart après les frais de réseau',
      'Évaluer les risques liés à la liquidité et à la volatilité',
    ],
    pillars: [
      {
        title: 'Un registre, pas une promesse',
        body: 'Chaque montant entrant ou sortant est une écriture immuable que vous pouvez consulter ligne par ligne, avec sa source.',
      },
      {
        title: 'Dépôts vérifiés sur la blockchain',
        body: 'Le hash, le réseau, la destination, le contrat du jeton, le montant et les confirmations sont vérifiés avant tout crédit.',
      },
      {
        title: 'Retraits effectués manuellement',
        body: 'Un opérateur envoie le paiement depuis un portefeuille externe et enregistre le hash. Aucune clé privée n’est conservée ici.',
      },
    ],
    plainTitle: 'Cette plateforme, en termes simples',
    plainSubtitle: 'Nous préférons être francs dès le départ plutôt que de vous laisser le découvrir plus tard.',
    trueTitle: 'Ce qui est vrai',
    trueItems: [
      'Les dépôts sont de véritables transactions sur la blockchain vers une adresse de portefeuille de la plateforme.',
      'Chaque dépôt est vérifié sur la blockchain — hash de transaction, réseau, adresse de destination, contrat du jeton, montant et confirmations — avant tout crédit.',
      'Le solde de votre tableau de bord est un solde inscrit dans le registre interne de la plateforme. Chaque modification est une écriture comptable immuable que vous pouvez consulter.',
      'Les retraits sont payés manuellement par un opérateur, et le véritable hash de transaction vous est communiqué.',
    ],
    warningTitle: '🚀 Faites partie de quelque chose de plus grand',
    warningBody:
      'Faites le premier pas aujourd’hui, participez en toute confiance et prenez part à notre parcours dès le début. Découvrez comment vous pouvez contribuer au développement de notre activité.',
    howTitle: 'Fonctionnement',
    step: (n: number) => `Étape ${n}`,
    steps: [
      {
        title: 'Rejoindre sur invitation',
        body: 'Inscrivez-vous avec un code fourni par un membre existant. Votre parrain est défini lors de l’inscription et ne peut ensuite être modifié.',
      },
      {
        title: 'Déposer des USDT',
        body: 'Envoyez des USDT à l’adresse de la plateforme affichée, sur un réseau pris en charge. Nous vérifions la transaction sur la blockchain et créditons le montant vérifié.',
      },
      {
        title: 'Activer un forfait',
        body: 'Un forfait définit le nombre de tâches que vous pouvez effectuer par jour ainsi que les paramètres de récompense utilisés pour calculer le paiement de chaque tâche.',
      },
      {
        title: 'Effectuer les tâches quotidiennes',
        body: 'Examinez des scénarios de marché des cryptomonnaies, estimez les écarts après frais et relevez les risques liés à la liquidité. Chaque exercice est soumis à un délai mesuré par le serveur.',
      },
      {
        title: 'Réclamer les récompenses',
        body: 'Une fois le délai écoulé, réclamez la récompense configurable de la plateforme. Elle est calculée par le serveur et enregistrée dans votre registre ; elle ne provient pas d’une transaction.',
      },
      {
        title: 'Effectuer un retrait',
        body: 'Demandez un retrait vers votre propre portefeuille. Des règles de délai s’appliquent. Un opérateur envoie le paiement et enregistre le hash de transaction.',
      },
    ],
    ctaTitle: 'Vous avez un code d’invitation ?',
    ctaBodyBefore: 'Lisez d’abord les ',
    ctaFaq: 'FAQ',
    ctaBodyMiddle: ' et les ',
    ctaTerms: 'conditions',
    ctaBodyAfter: '. Elles précisent les règles de retrait et les risques.',
    ctaButton: 'Créer votre compte',
  },

  auth: {
    signInTitle: 'Se connecter',
    signInSubtitle: 'Heureux de vous revoir sur ArbiFlow.',
    noAccount: 'Vous n’avez pas encore de compte ?',
    registerLink: 'S’inscrire sur invitation',
    haveAccount: 'Vous avez déjà un compte ?',
    signInLink: 'Se connecter',
    registerTitle: 'Créer votre compte',
    registerSubtitle: 'ArbiFlow est accessible uniquement sur invitation. Vous avez besoin d’un code fourni par un membre existant.',
    invalidInviteTitle: 'Ce lien d’invitation n’est pas valide',
    invalidInviteBody: (code: string) =>
      `Le code ${code} n’appartient pas à un membre actif. Demandez à votre parrain un lien valide ou saisissez un autre code ci-dessous.`,
    inviteAccepted: (code: string) => `Code d’invitation ${code} accepté.`,
    email: 'E-mail',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    username: 'Nom d’utilisateur',
    invitationCode: 'Code d’invitation',
    signingIn: 'Connexion en cours…',
    creatingAccount: 'Création de votre compte…',
    createAccount: 'Créer un compte',
  },

  dashboard: {
    welcome: (name: string) => `Heureux de vous revoir, ${name}`,
    intro: 'Voici l’état actuel de votre compte.',
    accountSuspended: (status: string) => `Votre compte est ${status}`,
    accountSuspendedBody:
      'Les tâches, les dépôts et les retraits sont désactivés tant que votre compte est dans cet état. Contactez l’assistance pour en savoir plus.',
    balanceLabel: 'Solde interne de la plateforme · registre',
    balanceNote:
      'Il ne s’agit pas d’un solde sur la blockchain. Ce montant figure dans le registre interne de la plateforme et est adossé à vos dépôts vérifiés et aux récompenses enregistrées sur votre compte. Chaque mouvement peut être audité.',
    viewLedger: 'Voir le registre →',
    movementLabel: 'Mouvements récents du registre',
    movementCount: (n: number) => `${n} écritures`,
    today: 'Aujourd’hui',
    taskProgress: 'Progression des tâches',
    tasksUnit: 'tâches',
    earnedToday: 'Gains du jour',
    currentTier: 'Niveau actuel',
    openTasks: 'Voir les tâches du jour',
    allTasksDone: 'Toutes les tâches sont terminées',
    totalRewards: 'Récompenses totales',
    totalRewardsSub: 'Créditées dans votre registre',
    totalDeposited: 'Total des dépôts',
    totalDepositedSub: 'Vérifiés sur la blockchain',
    totalWithdrawn: 'Total des retraits',
    totalWithdrawnSub: 'Réglés manuellement',
    pendingWithdrawal: 'Retrait en attente',
    pendingWithdrawalSub: 'Retenu pendant l’examen',
    activatePlanTitle: 'Activez un forfait pour commencer à gagner des récompenses de tâches',
    activatePlanBody:
      'Les récompenses des tâches ne sont versées qu’aux comptes disposant d’un forfait VIP actif. L’activation est prélevée sur le solde interne de votre compte sur la plateforme.',
    viewPlans: 'Voir les forfaits',
    depositUsdt: 'Déposer des USDT',
    firstWithdrawalTitle: 'Premier retrait pas encore disponible',
    firstWithdrawalBody: (days: number, waitDays: number, cooldown: number) =>
      `Votre premier retrait sera disponible dans ${days} jour${days === 1 ? '' : 's'}, soit ${waitDays} jours après l’activation de votre forfait. Ensuite, le délai d’attente sera de ${cooldown} jours ouvrés (du lundi au vendredi).`,
    unreadNotifications: 'Notifications non lues',
    communityReviewsTitle: 'Avis de la communauté',
    communityReviewsDescription:
      'Publiés avec l’accord de leur auteur. Les déclarations concernant les retraits ou les gains ne sont publiées que lorsqu’elles peuvent être vérifiées.',
    communityReviewsEmpty: 'Aucun avis vérifié à afficher pour le moment.',
    communityReviewVerified: 'Avis vérifié',
    communityReviewRating: 'Note : {rating} sur 5',
    pauseReviews: 'Mettre la rotation en pause',
    resumeReviews: 'Reprendre la rotation',
    recentLedger: 'Registre récent',
    fullHistory: 'Historique complet',
    noActivityTitle: 'Aucune activité pour le moment',
    noActivityBody: 'Votre registre affichera chaque dépôt, récompense et retrait dès qu’ils auront lieu.',
    firstDeposit: 'Effectuer votre premier dépôt',
    yourTeam: 'Votre équipe',
    open: 'Ouvrir',
    totalMembers: 'Nombre total de membres',
    direct: 'Directs',
    level: (n: number) => `Niveau ${n}`,
    commissionNote:
      'La commission provient des frais d’activation VIP perçus par la plateforme, aux taux définis par l’opérateur. Elle ne représente pas une part du dépôt d’un autre membre.',
  },

  tasks: {
    eyebrow: (n: number) => `${n} signal${n === 1 ? '' : 'ux'} de marché dans le lot du jour`,
    titleWaiting: (n: number) => `${n} signal${n === 1 ? '' : 'ux'} de marché vous attend${n === 1 ? '' : 'ent'}`,
    titlePlain: 'Tâches quotidiennes',
    description: (seconds: number) =>
      `Votre lot de tâches est réinitialisé chaque jour à 00:00 UTC. Chaque exercice d’analyse dispose d’un délai de ${seconds} secondes mesuré par le serveur — le compte à rebours affiché n’est qu’indicatif.`,
    completedToday: 'Terminées aujourd’hui',
    earnedToday: 'Gains du jour',
    availableToday: 'Disponibles aujourd’hui',
    basedOn: (plan: string) => `Selon ${plan}`,
    requiresPlan: 'Un forfait actif est nécessaire',
    disabledTitle: 'Les tâches sont désactivées',
    disabledBody: (status: string) => `Votre compte est ${status}. Contactez l’assistance pour en savoir plus.`,
    withdrawalLockTitle: 'Tâches suspendues après un retrait',
    withdrawalLockBody: (unlockAt: string) => `L’accès à vos tâches est suspendu jusqu’au ${unlockAt} après votre demande de retrait.`,
    withdrawalLockUnknown: 'L’accès à vos tâches est suspendu après une demande de retrait. Actualisez la page dans un instant pour vérifier quand les tâches seront de nouveau disponibles.',
    needPlanTitle: 'Activez un forfait VIP pour réclamer des récompenses',
    needPlanBody:
      'Vous pouvez consulter les tâches du jour, mais les récompenses ne peuvent être réclamées qu’avec un forfait actif. Le montant de la récompense est déterminé par les paramètres de récompense des tâches de votre forfait.',
    noTasksTitle: 'Aucune tâche disponible',
    noTasksBody: 'Aucune tâche active n’est configurée pour le moment. Veuillez revenir plus tard.',
    howTitle: 'Fonctionnement des récompenses des tâches',
    howItems: (limit: number) => [
      'Le montant de la récompense est calculé par le serveur à partir de votre forfait actif au moment où vous la réclamez, jamais depuis votre navigateur.',
      'Le minuteur est imposé par la base de données. Toute réclamation avant la fin du délai est rejetée, quel que soit le contenu affiché à l’écran.',
      `Vous pouvez effectuer au maximum ${limit} tâches par jour, et chaque tâche ne peut être récompensée qu’une seule fois par jour.`,
    ],
    card: {
      lot: (n: string) => `Signal nº ${n}`,
      noPhoto: 'Vue du marché indisponible',
      enlarge: (title: string) => `Agrandir la vue du marché pour ${title}`,
      collapse: (title: string) => `Réduire la vue du marché pour ${title}`,
      clickEnlarge: 'Cliquer pour agrandir',
      clickShrink: 'Cliquer pour réduire',
      counter: (slot: number, total: number) => `Tâche ${slot} / ${total}`,
      difficulty: { EASY: 'Facile', MEDIUM: 'Moyenne', HARD: 'Difficile' },
      completed: 'Terminée',
      reward: 'Récompense',
      earned: 'Gagné',
      windowOpen: 'Délai d’analyse',
      windowDone: 'Délai d’analyse écoulé',
      secondsRemaining: (n: number) => `Il reste ${n} secondes`,
      claimed: 'Récompense réclamée',
      claiming: 'Réclamation en cours…',
      claim: (amount: string) => `Réclamer ${amount}`,
      claimIn: (amount: string, time: string) => `Réclamer ${amount} · ${time}`,
      starting: 'Démarrage…',
      start: 'Démarrer l’analyse →',
      needPlan: 'Un forfait VIP actif est nécessaire pour réclamer une récompense.',
      withdrawalLocked: 'Les actions liées aux tâches sont suspendues tant que le verrou de retrait est actif.',
      recorded: 'Enregistré dans votre registre.',
      windowNote: (seconds: number) => `Délai de ${seconds} s mesuré par le serveur.`,
    },
  },

  vip: {
    title: 'Forfaits VIP',
    description:
      'L’activation d’un forfait définit votre quota quotidien de tâches ainsi que les paramètres utilisés pour calculer la récompense de chaque tâche terminée.',
    addFunds: 'Ajouter des fonds',
    current: 'Actuel',
    activationAmount: 'Montant d’activation',
    dailyTasks: 'Tâches quotidiennes',
    rewardPerTask: 'Récompense par tâche',
    dailyBudget: 'Budget quotidien des récompenses de tâches',
    historyTitle: 'Historique de vos activations',
    noHistory: 'Vous n’avez encore activé aucun forfait.',
    from: 'De',
    to: 'À',
    charged: 'Débité',
    historyNote:
      'Les récompenses déjà réclamées avec un forfait précédent ne sont jamais recalculées. Chaque tâche conserve la récompense qui lui a été versée et chaque écriture du registre est immuable.',
    activePlan: 'Forfait actif',
    lowerThanCurrent: 'Inférieur à votre forfait actuel',
    activating: 'Activation en cours…',
    confirmBody: (amount: string, plan: string) =>
      `${amount} sera déduit du solde interne de votre compte sur la plateforme pour activer ${plan}. Cette opération sera enregistrée dans votre registre sous la forme d’une écriture VIP_ACTIVATION et ne peut pas être annulée automatiquement.`,
    needMore: (amount: string) => `Il vous manque ${amount}`,
    activateFor: (amount: string) => `Activer pour ${amount}`,
    insufficient: 'Solde interne de la plateforme insuffisant',
  },

  wallet: {
    title: 'Portefeuille',
    description: 'Votre registre interne sur la plateforme. Chaque mouvement ci-dessous est une écriture comptable immuable.',
    balanceLabel: 'Solde interne de la plateforme',
    balanceNote: '',
    todaysRewards: 'Récompenses du jour',
    totalRewards: 'Récompenses totales',
    totalDeposited: 'Total déposé',
    chainVerified: 'Vérifié sur la blockchain',
    totalWithdrawn: 'Total retiré',
    pendingWithdrawal: 'Retrait en attente',
    lockedUntilSettled: 'Bloqué jusqu’au règlement',
    nothingLocked: 'Aucun montant bloqué',
    totalBalance: 'Solde total',
    availablePlusLocked: 'Disponible et bloqué',
    lockedTitle: 'Des fonds sont bloqués pour une demande de retrait',
    lockedBody: (amount: string) =>
      `${amount} est réservé à un retrait qui n’a pas encore été réglé. Ce montant est retiré de votre solde disponible afin d’éviter qu’il soit dépensé deux fois.`,
    recentMovements: 'Mouvements récents',
  },

  history: {
    title: 'Historique du registre',
    description: (total: number) =>
      `${total} écriture${total === 1 ? '' : 's'}. Le registre est uniquement cumulatif : les corrections apparaissent sous forme de nouvelles écritures, jamais de modifications.`,
    pagination: 'Pagination',
  },

  ledgerTable: {
    empty: 'Aucune écriture dans le registre pour le moment.',
    balanceAfter: 'Solde après',
  },

  ledgerTypes: {
    DEPOSIT: 'Dépôt',
    TASK_REWARD: 'Récompense de tâche',
    REFERRAL_REWARD: 'Commission de parrainage',
    VIP_ACTIVATION: 'Activation VIP',
    WITHDRAWAL_HOLD: 'Retrait bloqué',
    WITHDRAWAL_RELEASE: 'Retrait débloqué',
    WITHDRAWAL_COMPLETED: 'Retrait payé',
    ADMIN_ADJUSTMENT: 'Ajustement',
    REFUND: 'Remboursement',
  },

  statuses: {
    deposit: { PENDING: 'En attente', CONFIRMED: 'Confirmé', REJECTED: 'Rejeté', CANCELLED: 'Annulé' },
    withdrawal: {
      PENDING: 'En attente',
      PROCESSING: 'En cours de traitement',
      PAID: 'Payé',
      REJECTED: 'Rejeté',
      CANCELLED: 'Annulé',
    },
    assignment: {
      AVAILABLE: 'Disponible',
      STARTED: 'Commencé',
      SUBMITTED: 'Soumis',
      COMPLETED: 'Terminé',
      REJECTED: 'Rejeté',
      EXPIRED: 'Expiré',
    },
    user: { ACTIVE: 'Actif', SUSPENDED: 'Suspendu', BANNED: 'Banni' },
    notification: { INFO: 'Information', SUCCESS: 'Succès', WARNING: 'Avertissement', ERROR: 'Erreur' },
  },

  notifications: {
    title: 'Notifications',
    unreadCount: (n: number) => `${n} non lue${n === 1 ? '' : 's'}`,
    allCaughtUp: 'Vous êtes à jour.',
    markAllRead: 'Tout marquer comme lu',
    markRead: 'Marquer comme lu',
    emptyTitle: 'Rien pour le moment',
    emptyBody:
      'Les dépôts, les récompenses des tâches, l’activité de parrainage et les mises à jour des retraits apparaissent tous sur cette page.',
  },

  profile: {
    title: 'Profil',
    description: 'Les informations de votre compte et vos paramètres de sécurité.',
    account: 'Compte',
    email: 'E-mail',
    username: 'Nom d’utilisateur',
    role: 'Rôle',
    roleMember: 'Membre',
    invitationCode: 'Code d’invitation',
    currentPlan: 'Forfait actuel',
    memberSince: 'Membre depuis',
    firstActivation: 'Première activation',
    notActivated: 'Pas encore activé',
    twoFactor: 'Authentification à deux facteurs',
    enabled: 'Activée',
    notEnabled: 'Non activée',
    changeUsername: 'Modifier le nom d’utilisateur',
    changePassword: 'Modifier le mot de passe',
    usernameHint: 'Visible par les membres de votre équipe. De 3 à 24 caractères.',
    saveUsername: 'Enregistrer le nom d’utilisateur',
    saving: 'Enregistrement…',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    passwordHint: 'Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.',
    updatePassword: 'Mettre à jour le mot de passe',
    updating: 'Mise à jour…',
    immutableTitle: 'Éléments qui ne peuvent pas être modifiés',
    immutableItems: [
      'Votre code d’invitation, afin que les liens d’invitation existants continuent de fonctionner.',
      'La personne qui vous a invité. La relation de parrainage est définie lors de l’inscription et imposée par la base de données.',
      'Les écritures de votre registre. Chaque modification du solde est définitive ; les corrections sont ajoutées sous forme de nouvelles écritures.',
    ],
  },

  team: {
    title: 'Mon équipe',
    description: 'Les inscriptions se font uniquement sur invitation. Toute personne qui s’inscrit avec votre lien rejoint votre équipe.',
    yourInvitation: 'Votre invitation',
    invitationCode: 'Code d’invitation',
    invitationLink: 'Lien d’invitation',
    copyCode: 'Copier le code',
    copyLink: 'Copier le lien',
    totalTeam: 'Équipe totale',
    acrossLevels: 'Sur les trois niveaux',
    levelDirect: 'Niveau 1 — parrain direct',
    level2: 'Niveau 2 — parrain du parrain',
    level3: 'Niveau 3 — troisième génération',
    commissionPercent: (p: string) => `Commission de ${p} %`,
    commissionEarned: 'Commissions gagnées',
    commissionEarnedSub: 'Versées sur votre solde interne de la plateforme',
    activeMembers: 'Membres disposant d’un forfait actif',
    ofTotal: (n: number) => `sur ${n} au total`,
    fundingTitle: 'Financement des commissions de parrainage',
    fundingBody:
      'La commission correspond à une part des revenus réellement perçus par la plateforme : lorsqu’un membre de votre équipe active un forfait VIP, un pourcentage défini des frais d’activation est crédité à son parrain. Aucun montant ne provient du dépôt d’un autre membre et les dépôts seuls ne génèrent aucune commission.',
    disabledNote: ' Les commissions de parrainage sont actuellement désactivées par l’opérateur.',
    emptyTitle: 'Aucun membre dans votre équipe pour le moment',
    emptyBody:
      'Partagez votre lien d’invitation. Toute personne qui s’inscrit avec ce lien apparaîtra ici, ainsi que les personnes qu’elle invite, jusqu’à trois niveaux.',
    levelHeading: (n: number) => `Niveau ${n}`,
    memberCount: (n: number, percent: string) => `${n} membre${n === 1 ? '' : 's'} · ${percent} %`,
    joined: 'Inscription',
    plan: 'Forfait',
    memberFallback: 'Membre',
  },

  deposit: {
    title: 'Déposer des USDT',
    description:
      'Envoyez de véritables USDT depuis votre propre portefeuille à l’adresse de la plateforme ci-dessous. Après l’envoi, téléversez une capture d’écran du retrait afin qu’un administrateur l’examine avant que votre solde soit crédité.',
    readFirstTitle: 'À lire avant l’envoi',
    readFirstItems: [
      'Envoyez uniquement le jeton indiqué, sur le réseau exact indiqué. Tout autre envoi est irrécupérable.',
      'Une capture d’écran et son OCR ne constituent pas à eux seuls une preuve de fonds. Un administrateur vérifie le portefeuille destinataire avant de créditer votre solde.',
    ],
    newDeposit: 'Nouveau dépôt',
    noneInProgressTitle: 'Aucun dépôt en cours',
    noneInProgressBody: 'Créez un dépôt pour afficher l’adresse à laquelle envoyer les fonds.',
    sendOn: (amount: string, network: string) => `Envoyer ${amount} sur ${network}`,
    reference: (code: string, created: string) => `Référence ${code} · créée le ${created}`,
    qrAlt: (network: string) => `Code QR de l’adresse de dépôt sur ${network}`,
    platformAddress: 'Adresse de dépôt de la plateforme',
    network: 'Réseau',
    token: 'Jeton',
    tokenContract: 'Contrat du jeton',
    confirmationsRequired: 'Confirmations requises',
    confirmationsCurrent: 'Confirmations actuelles',
    noAddress: 'Aucune adresse de dépôt active n’est configurée pour ce réseau.',
    submittedTx: 'Transaction soumise',
    waitingVerification: (seen: number, needed: number) =>
      `En attente de vérification. ${seen}/${needed} confirmations reçues.`,
    alreadySent: 'Vous avez déjà envoyé les fonds ?',
    historyTitle: 'Historique des dépôts',
    noDeposits: 'Aucun dépôt pour le moment.',
    declared: 'Déclaré',
    credited: 'Crédité',
    transaction: 'Transaction',
    notSubmitted: 'Non soumis',
    form: {
      unavailableTitle: 'Les dépôts ne sont pas encore disponibles',
      unavailableBody:
        'Aucune adresse de dépôt n’est configurée pour les réseaux. Contactez l’assistance avant d’envoyer des fonds.',
      errorTitle: 'Impossible de créer les instructions de dépôt',
      currency: 'Devise',
      network: 'Réseau',
      amount: 'Montant',
      unavailableSuffix: ' — indisponible',
      disabledSuffix: ' — désactivé',
      amountHint: (minimum: string) =>
        `Minimum : ${minimum}. Un administrateur saisit le montant crédité après avoir vérifié les fonds reçus.`,
      creating: 'Création…',
      submit: 'Obtenir les instructions de dépôt',
      note: 'Saisissez le montant que vous comptez envoyer. Après l’envoi, téléversez les détails du retrait effectué ; un administrateur vérifiera le montant reçu avant de le créditer.',
      proofInstructions:
        'Téléversez une capture d’écran complète des détails du retrait effectué. L’OCR fonctionne sur cet appareil et vérifie le montant, le réseau, la destination, le statut et la date. Un administrateur vérifie également le paiement séparément.',
      proofScreenshot: 'Capture d’écran du paiement',
      proofFileTooLarge: 'La capture d’écran doit faire 3 Mo ou moins.',
      proofInvalidFile: 'Choisissez une image JPEG, PNG ou WebP.',
      proofOcrFailed: 'Impossible de lire cette capture d’écran. Essayez une image claire et complète.',
      proofOcrRunning: 'Lecture de la capture d’écran sur cet appareil…',
      proofOcrComplete: 'Détails de la capture d’écran détectés',
      proofOcrSummary: (amount: string, network: string, status: string, date: string) =>
        `${amount} USDT · ${network} · ${status} · ${date}`,
      proofOcrAddressApproximate:
        'La destination semble correspondre de près selon l’OCR. Un administrateur la vérifiera à partir de la capture d’écran.',
      proofOcrOnchainTxId: 'TXID sur la blockchain détecté (non vérifié) :',
      proofOcrBinanceTransferId: 'Référence de transfert Binance (pas un TXID sur la blockchain, non vérifiée) :',
      proofOcrIncomplete: 'Impossible de faire correspondre tous les détails requis',
      proofErrors: {
        amount: 'Impossible de lire un montant en USDT.',
        amountMismatch: 'Le montant de la capture d’écran ne correspond pas à cette demande de dépôt.',
        network: 'Impossible de faire correspondre le réseau de la capture d’écran à ce dépôt.',
        address: 'La destination indiquée sur la capture d’écran ne correspond pas à l’adresse de dépôt de la plateforme.',
        status: 'La capture d’écran ne montre pas un retrait effectué.',
        date: 'Impossible de lire une date de transaction valide.',
      },
      proofSubmit: 'Soumettre la capture d’écran pour examen',
      proofSubmitting: 'Envoi de la capture d’écran…',
      proofPrivacy: 'La capture d’écran est stockée de manière privée et seul un administrateur peut l’ouvrir.',
      proofAwaitingReviewTitle: 'En attente de l’examen d’un administrateur',
      proofAwaitingReview:
        'Votre capture d’écran a été envoyée. Le dépôt reste en attente jusqu’à ce qu’un administrateur vérifie les fonds reçus.',
      proofSubmitted: 'Capture d’écran envoyée',
      checking: 'Vérification…',
      recheck: 'Vérifier à nouveau le statut',
      cancelVerification: 'Annuler la vérification',
      cancelling: 'Annulation…',
    },
  },

  withdraw: {
    title: 'Retrait',
    description: '',
    available: 'Disponible',
    lockedInRequests: 'Bloqué dans les demandes',
    totalWithdrawn: 'Total retiré',
    scheduleTitle: 'Calendrier des retraits',
    eligibleNow: 'Éligible maintenant',
    notEligible: 'Pas encore éligible',
    firstWithdrawal: 'Premier retrait',
    daysAfterActivation: (days: number) => `${days} jours après l’activation`,
    then: 'Ensuite',
    onceEvery: (days: number) => `tous les ${days} jours ouvrés`,
    unlocksOn: 'Disponible le',
    nextWindow: 'Prochaine période',
    notStarted: 'Pas commencé',
    serverClockNote:
      'Ces règles sont appliquées par le serveur selon sa propre horloge. Modifier l’heure de votre appareil n’a aucun effet.',
    reasons: {
      NO_ACTIVATION:
        'La période d’attente commence à partir de votre première activation VIP. Activez un forfait pour lancer le décompte.',
      ACCOUNT_NOT_ACTIVE: 'Votre compte n’est pas actif. Contactez l’assistance pour en savoir plus.',
      WITHDRAWAL_ALREADY_PENDING: 'Un retrait est déjà en cours. Un seul retrait peut être ouvert à la fois.',
      COOLDOWN_ACTIVE: 'Le délai d’attente suivant votre précédent retrait payé n’est pas encore écoulé.',
      FIRST_WITHDRAWAL_WAITING_PERIOD: 'Votre premier retrait n’est pas encore disponible.',
      GENERIC: 'Vous ne pouvez pas effectuer de retrait pour le moment.',
    },
    newRequest: 'Nouvelle demande de retrait',
    settlementTitle: 'Déroulement du règlement',
    settlementSteps: [
      {
        title: 'Demande',
        body: 'Le montant est immédiatement retiré de votre solde disponible et réservé comme retrait en attente afin qu’il ne puisse pas être dépensé deux fois.',
      },
      {
        title: 'Enregistrement',
        body: 'Le hash de transaction obtenu est associé à votre retrait et affiché ici. Le registre est clôturé par une écriture WITHDRAWAL_COMPLETED.',
      },
      {
        title: 'Tâches',
        body: 'Après l’envoi d’une demande de retrait, vos tâches seront suspendues pendant 48 heures. Vous pourrez reprendre les tâches une fois cette période écoulée.',
      },
    ],
    fee: 'Frais',
    requested: 'Demandé',
    destination: 'Destination',
    historyTitle: 'Historique des retraits',
    noWithdrawals: 'Aucun retrait pour le moment.',
    availableInDays: (days: number) => `Disponible dans ${days} jour${days === 1 ? '' : 's'}.`,
    unavailable: 'Retrait indisponible.',
    openRequest: 'Demande ouverte',
    form: {
      notAvailableTitle: 'Retrait indisponible',
      requestReceived: 'Demande reçue',
      requestRejected: 'Demande rejetée',
      amount: 'Montant',
      amountHint: (available: string, minimum?: string, fee?: string, platformFee?: string) =>
        minimum && fee && platformFee !== undefined
          ? `Disponible : ${available} · Minimum : ${minimum} · Frais ArbiFlow : ${platformFee} · Frais de réseau : ${fee}`
          : `Disponible : ${available}`,
      network: 'Réseau',
      disabledSuffix: ' — désactivé',
      destination: 'Adresse du portefeuille de destination',
      destinationHint: 'Vérifiez-la attentivement : les paiements manuels sont irréversibles.',
      youReceive: 'Vous recevez',
      deducted: 'Déduit du solde',
      platformFee: 'Frais ArbiFlow',
      networkFee: 'Frais de réseau',
      submitting: 'Envoi…',
      submit: 'Demander un retrait',
      note: 'Lors de l’envoi, le montant est immédiatement bloqué et retiré de votre solde disponible. Le paiement est effectué manuellement par l’équipe opérationnelle depuis un portefeuille externe ; le hash de transaction apparaîtra ici une fois le paiement envoyé.',
      cancelRequest: 'Annuler la demande',
      confirmCancel: 'Annuler et débloquer les fonds ?',
      cancelling: 'Annulation…',
      yesCancel: 'Oui, annuler',
      keep: 'Conserver',
    },
  },

  authForms: {
    accountCreated: 'Compte créé',
    confirmationSent: (email: string) => `Nous avons envoyé un lien de confirmation à ${email}. Ouvrez-le, puis connectez-vous.`,
    goToSignIn: 'Accéder à la connexion',
    inviteHint: 'Les inscriptions se font uniquement sur invitation. Demandez son code au membre qui vous a invité.',
    usernameHint: 'De 3 à 24 caractères.',
    passwordHint: 'Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.',
    acceptBefore: 'J’ai lu et j’accepte les ',
    acceptTerms: 'conditions',
    acceptMiddle: ' et la ',
    acceptPrivacy: 'politique de confidentialité',
    acceptAfter:
      ', et je comprends que le solde de mon tableau de bord est un solde inscrit dans le registre interne de la plateforme, et non dans un portefeuille sur la blockchain.',
    notConfirmedTitle: 'Confirmez d’abord votre adresse e-mail',
    notConfirmedBody:
      'Ce compte doit encore être confirmé. Ouvrez le lien de confirmation que nous vous avons envoyé par e-mail, puis connectez-vous.',
    resendEmailLabel: 'Votre adresse e-mail',
    resendButton: 'Renvoyer l’e-mail de confirmation',
    resendSending: 'Envoi…',
    confirmTitle: 'Confirmez votre adresse e-mail',
    confirmLead: 'Votre compte a été créé, mais il n’est pas encore utilisable. Nous avons envoyé un lien de confirmation à',
    confirmStep1:
      'Ouvrez votre boîte de réception et cherchez notre message. Vérifiez le dossier de courriers indésirables si vous ne le trouvez pas.',
    confirmStep2: 'Cliquez sur le lien de confirmation.',
    confirmStep3: 'Revenez ensuite vous connecter. Toute connexion effectuée avant cette étape sera refusée.',
    nothingArrived: 'Vous n’avez rien reçu ?',
    confirmedGoSignIn: 'J’ai confirmé mon adresse e-mail, accéder à la connexion',
  },

  legal: {
    faq: {
      title: 'Fonctionnement',
      intro:
        'Des réponses claires, y compris celles qui ne sont pas flatteuses. Si quoi que ce soit sur cette page contredit ce qu’on vous a dit au sujet de la plateforme, cette page décrit ce que le logiciel fait réellement.',
      warnTitle: 'À lire d’abord',
      warnBody:
        'Le solde de votre tableau de bord est un solde inscrit dans le registre interne de la plateforme, et non dans un portefeuille sur la blockchain. Les tâches sont des exercices d’analyse de marché : la plateforme n’exécute pas de transactions. Les récompenses sont des paiements configurables de la plateforme pour le travail accompli, et non des rendements d’investissement ; rien n’est garanti.',
      ctaRegister: 'S’inscrire sur invitation',
      ctaTerms: 'Conditions d’utilisation',
      sections: [
        {
          heading: 'Inscription',
          items: [
            {
              q: 'Pourquoi ai-je besoin d’un code d’invitation ?',
              a: 'Les inscriptions se font uniquement sur invitation. Vous avez besoin d’un code de parrainage fourni par un membre actif existant, généralement sous la forme d’un lien /register?ref=ABC123. Le code est vérifié par le serveur avant la création du compte ; un code manquant, inconnu ou suspendu est refusé.',
            },
            {
              q: 'Puis-je changer la personne qui m’a invité par la suite ?',
              a: 'Non. La relation est enregistrée une seule fois lors de l’inscription et ne peut ensuite être modifiée, ni par vous ni par l’assistance. Cela garantit l’intégrité de la structure de parrainage.',
            },
            {
              q: 'Que gagne-t-on à inviter des personnes ?',
              a: 'Lorsqu’un membre de votre équipe active un niveau VIP, un pourcentage défini de ses frais d’activation vous est crédité, jusqu’à trois niveaux. Il s’agit d’une part des revenus réellement perçus par la plateforme. Le dépôt d’un autre membre ne vous est jamais versé et les dépôts seuls ne génèrent aucune commission.',
            },
          ],
        },
        {
          heading: 'Argent',
          items: [
            {
              q: 'Comment un dépôt est-il crédité ?',
              a: 'Vous créez une demande de dépôt, envoyez des USDT depuis votre propre portefeuille à l’adresse affichée, puis soumettez le hash de transaction. Notre serveur recherche la transaction sur la blockchain et vérifie le hash, le réseau, l’adresse de destination, le contrat du jeton, le montant, le nombre de confirmations et le fait que la transaction n’a pas déjà été créditée. Le montant n’est versé dans votre registre que si toutes ces vérifications sont concluantes. Le montant que vous avez saisi n’est jamais celui qui est crédité : c’est la blockchain qui fait foi.',
            },
            {
              q: 'Plusieurs personnes utilisent la même adresse de dépôt. Mes fonds risquent-ils d’être mélangés aux leurs ?',
              a: 'Non. Les dépôts sont identifiés par la transaction elle-même, jamais par le montant. Un même hash de transaction ne peut être crédité qu’une seule fois, grâce à une contrainte unique dans la base de données.',
            },
          ],
        },
        {
          heading: 'VIP et tâches',
          items: [
            {
              q: 'Que fait l’activation d’un niveau VIP ?',
              a: 'Elle prélève le montant d’activation sur votre solde interne et définit les paramètres utilisés pour calculer vos futures récompenses de tâches. Les récompenses déjà créditées ne sont jamais recalculées lorsque vous changez de niveau.',
            },
            {
              q: 'Le taux de récompense garantit-il un rendement sur mon argent ?',
              a: 'Non. Il s’agit d’un paramètre configurable qui détermine le montant du pool de récompenses pour une journée de tâches terminées. L’opérateur peut le modifier. C’est le paiement d’un travail effectué sur la plateforme, et non un revenu d’investissement ; il n’est assorti d’aucune garantie.',
            },
            {
              q: 'Comment fonctionnent les tâches quotidiennes ?',
              a: 'Vous pouvez recevoir jusqu’à trois exercices d’analyse de marché par jour UTC. Ils vous demandent d’examiner un scénario de marché des cryptomonnaies, par exemple en comparant un écart affiché aux frais ou au risque lié à la liquidité. Le démarrage d’un exercice lance le même minuteur de trois minutes mesuré par le serveur ; une fois écoulé, vous pouvez réclamer la récompense configurable de la plateforme. Ces exercices ne se connectent pas à une plateforme d’échange et ne passent aucun ordre. Le serveur impose le délai et la limite quotidienne, et chaque tâche ne peut être réclamée qu’une fois.',
            },
            {
              q: 'Quand les nouvelles tâches apparaissent-elles ?',
              a: 'Au début de chaque jour UTC. Les anciennes tâches sont conservées définitivement dans l’historique et ne sont jamais supprimées.',
            },
          ],
        },
        {
          heading: 'Délais de retrait',
          items: [
            {
              q: 'Quand puis-je effectuer mon premier retrait ?',
              a: 'Trente jours après l’événement d’activation défini par l’opérateur. Jusque-là, la page des retraits indique le nombre de jours restants. La règle est appliquée par le serveur à partir de ses propres horodatages.',
            },
            {
              q: 'Et ensuite ?',
              a: 'Un retrait tous les dix jours ouvrés (du lundi au vendredi), à compter de votre dernier retrait effectué. Les week-ends ne sont pas comptabilisés. La période d’attente et le délai entre deux retraits sont configurables par l’opérateur, et les valeurs en vigueur sont indiquées sur la page des retraits.',
            },
            {
              q: 'Que deviennent les fonds lorsqu’une demande est en cours ?',
              a: 'Ils sont immédiatement bloqués : le montant est retiré de votre solde disponible et placé dans un solde en attente, sous la forme d’une écriture du registre. Si la demande est rejetée ou annulée, le montant bloqué vous est rendu ; si elle est payée, le blocage est converti en retrait effectué. Cela évite de dépenser deux fois le même solde.',
            },
          ],
        },
      ],
    },

    terms: {
      title: 'Conditions d’utilisation',
      templateNote:
        'Ces conditions sont un modèle fourni avec le logiciel. Avant d’exploiter cette plateforme à des fins commerciales, faites-les examiner et adapter par un avocat qualifié dans votre juridiction.',
      contactBefore: 'Les demandes d’assistance doivent être envoyées à l’adresse publiée dans l’application. Consultez également notre ',
      contactPrivacy: 'politique de confidentialité',
      contactMiddle: ' et notre page ',
      contactFaq: 'fonctionnement',
      contactAfter: '.',
      sections: [
        {
          title: 'Acceptation',
          paragraphs: [
            'En vous inscrivant sur la plateforme ou en l’utilisant, vous acceptez ces conditions. Si vous ne les acceptez pas, ne vous inscrivez pas. Vous devez avoir atteint l’âge légal dans votre juridiction et être légalement autorisé à utiliser un service de ce type.',
          ],
        },
        {
          title: 'Accès sur invitation uniquement',
          paragraphs: [
            'La création d’un compte nécessite un code d’invitation valide fourni par un membre actif existant. La relation de parrainage est enregistrée une seule fois, lors de l’inscription, et ne peut ensuite être modifiée. Toute tentative de manipulation de la structure de parrainage — auto-parrainage, comptes en double ou inscriptions automatisées — peut entraîner une suspension et la confiscation des fonds.',
          ],
        },
        {
          title: 'Votre compte',
          paragraphs: [
            'Un compte par personne. Vous êtes responsable de la sécurité de vos identifiants et de toute activité effectuée sur votre compte. Fournissez des informations exactes et tenez-les à jour. Nous pouvons suspendre ou résilier les comptes qui enfreignent ces conditions, sont utilisés à des fins illégales ou que nous avons des raisons raisonnables de croire frauduleux.',
          ],
        },
        {
          title: 'Dépôts',
          paragraphs: [
            'Les dépôts sont de véritables transferts d’actifs numériques sur des blockchains publiques, que vous envoyez depuis un portefeuille que vous contrôlez vers une adresse que nous affichons. Nous ne créditons votre solde interne qu’après avoir vérifié la transaction sur la blockchain : hash, réseau, adresse de destination, contrat du jeton, montant, nombre de confirmations et absence de crédit antérieur pour cette transaction.',
            'Les transferts sur la blockchain sont irréversibles. L’envoi du mauvais actif, l’utilisation du mauvais réseau ou l’envoi vers une autre adresse que celle affichée entraîne dans la plupart des cas une perte définitive que nous ne pouvons pas récupérer pour vous.',
          ],
        },
        {
          title: 'Niveaux VIP et récompenses des tâches',
          paragraphs: [
            'L’activation d’un niveau prélève le montant indiqué sur votre solde interne et définit les paramètres utilisés pour calculer les récompenses des tâches que vous effectuerez ensuite. Les récompenses déjà créditées ne sont jamais recalculées.',
            'Les taux de récompense sont des paramètres opérationnels configurables par l’opérateur et peuvent être modifiés à tout moment. Il s’agit de paiements de la plateforme pour les exercices d’analyse de marché terminés, et non de revenus issus de l’arbitrage ou du trading. Ce ne sont ni des intérêts, ni un rendement, ni un dividende, ni un rendement garanti ou prévisionnel sur une somme que vous avez déposée.',
          ],
        },
        {
          title: 'Tâches',
          paragraphs: [
            'Chaque membre actif reçoit un nombre limité d’exercices d’analyse du marché des cryptomonnaies par jour UTC. Ces exercices sont informatifs et n’exécutent aucune transaction. Un exercice doit être commencé et son délai doit être écoulé, selon la mesure de nos serveurs, avant que sa récompense de la plateforme puisse être réclamée. Les récompenses sont calculées côté serveur. Toute tentative de réclamer une récompense sans effectuer l’exercice, de réclamer deux fois la même récompense, de dépasser la limite quotidienne ou de manipuler les minuteurs ou les montants des récompenses depuis le client annule la récompense et peut entraîner une suspension.',
          ],
        },
        {
          title: 'Commission de parrainage',
          paragraphs: [
            'La commission correspond à une part configurable des frais d’activation VIP réellement perçus par l’opérateur auprès des membres de votre équipe, jusqu’à trois niveaux. Elle ne constitue pas une part du dépôt d’un membre et aucune commission n’est générée par le recrutement ou les dépôts seuls.',
          ],
        },
        {
          title: 'Comportements interdits',
          paragraphs: [
            'Ne créez pas plusieurs comptes, n’automatisez pas l’exécution des tâches, ne perturbez pas le service, ne tentez pas d’accéder aux données d’autres utilisateurs, n’utilisez pas la plateforme pour blanchir de l’argent ou à toute autre fin illégale et ne présentez pas la plateforme de manière trompeuse — notamment en la décrivant comme un investissement, une banque, un service réglementé ou un service offrant des rendements garantis.',
          ],
        },
        {
          title: 'Disponibilité et modifications',
          paragraphs: [
            'Le service est fourni « en l’état », sans garantie d’aucune sorte. Nous pouvons modifier, suspendre ou interrompre toute partie du service et modifier ces conditions ; les changements importants seront annoncés dans l’application. La poursuite de l’utilisation après une modification vaut acceptation de celle-ci.',
          ],
        },
        {
          title: 'Limitation de responsabilité',
          paragraphs: [
            'Dans la mesure maximale autorisée par la loi, l’opérateur n’est pas responsable des pertes indirectes, accessoires ou consécutives, des pertes de bénéfices ni des pertes résultant de l’état du réseau blockchain, d’erreurs de votre part concernant les adresses ou les réseaux, ou d’un accès non autorisé à votre compte dû à un défaut de protection de vos identifiants.',
          ],
        },
        {
          title: 'Résiliation',
          paragraphs: [
            'Vous pouvez cesser d’utiliser la plateforme à tout moment. Nous pouvons suspendre ou fermer un compte en cas de violation des présentes conditions. Lorsqu’un compte est fermé sans violation, tout solde interne restant est payable conformément aux règles et aux procédures d’examen habituelles des retraits.',
          ],
        },
        { title: 'Contact', paragraphs: [] },
      ],
    },

    privacy: {
      title: 'Politique de confidentialité',
      templateNote:
        'Il s’agit d’un modèle fourni avec le logiciel. Adaptez-le à votre juridiction et à vos modalités réelles d’hébergement avant toute exploitation publique.',
      warnTitle: 'Les données de la blockchain sont publiques et permanentes',
      warnBody:
        'Toute adresse de portefeuille que vous utilisez pour déposer, ainsi que toute adresse que vous nous communiquez pour un retrait, fait partie d’un registre public sur la blockchain que nous ne pouvons ni modifier ni effacer. La suppression de votre compte ne la supprime pas.',
      contactBefore: 'Vous pouvez adresser vos questions sur cette politique à l’adresse d’assistance publiée dans l’application. Consultez également nos ',
      contactTerms: 'conditions d’utilisation',
      contactAfter: '.',
      sections: [
        {
          title: 'Données collectées',
          paragraphs: [
            {
              label: 'Données du compte :',
              text: ' adresse e-mail, nom d’utilisateur choisi, mot de passe haché (géré par notre fournisseur d’authentification — nous ne voyons ni ne stockons jamais votre mot de passe), votre code de parrainage et le code utilisé lors de votre inscription.',
            },
            {
              label: 'Données financières :',
              text: ' demandes de dépôt, hash de transaction, montants vérifiés, adresses d’envoi et de réception, demandes de retrait et adresses de destination, ainsi que chaque écriture de votre registre interne.',
            },
            {
              label: 'Données d’activité :',
              text: ' attributions de tâches et heures d’exécution, activations VIP, notifications et horodatages de ces événements.',
            },
            {
              label: 'Données techniques :',
              text: ' adresse IP et agent utilisateur, utilisés pour limiter le débit, prévenir les abus et consigner les événements de sécurité.',
            },
          ],
        },
        {
          title: 'Utilisation des données',
          paragraphs: [
            {
              text: 'Pour gérer votre compte, vérifier les dépôts sur la blockchain, calculer et verser les récompenses, traiter les retraits, appliquer les limites quotidiennes des tâches et les règles de retrait, prévenir la fraude et les abus et respecter nos obligations légales.',
            },
            { text: 'Nous ne vendons pas vos données personnelles et ne les utilisons ni à des fins publicitaires ni pour établir des profils comportementaux.' },
          ],
        },
        {
          title: 'Personnes ayant accès aux données',
          paragraphs: [
            {
              text: 'L’accès est limité par la sécurité au niveau des lignes de la base de données : les utilisateurs connectés ne peuvent consulter que leur propre profil, leurs soldes, dépôts, retraits, tâches, registre et notifications. Les adresses e-mail des autres membres de votre équipe sont masquées. Les administrateurs peuvent consulter les comptes et les données financières lorsque cela est nécessaire au fonctionnement de la plateforme ou à l’examen d’abus ; chaque action privilégiée est consignée dans un journal d’audit.',
            },
            {
              text: 'Nous partageons des données avec nos fournisseurs d’infrastructure (hébergement de l’application, base de données et authentification) et avec des API publiques de blockchain lorsque nous vérifions un hash de transaction que vous avez soumis. Nous ne communiquons des données aux autorités que lorsque la loi l’exige.',
            },
          ],
        },
        {
          title: 'Conservation',
          paragraphs: [
            {
              text: 'Les données financières et les écritures du registre sont conservées de manière permanente : le registre est conçu pour être cumulatif et ne peut être ni modifié ni supprimé, ce qui rend les soldes vérifiables. L’historique des tâches est également conservé et n’est pas purgé. Les données du compte sont conservées tant que votre compte existe, puis aussi longtemps que nous sommes tenus de les conserver.',
            },
          ],
        },
        {
          title: 'Vos droits',
          paragraphs: [
            {
              text: 'Selon votre lieu de résidence, vous pouvez avoir le droit d’accéder à vos données personnelles, de les corriger, de les exporter ou de les effacer, ainsi que de vous opposer à certains traitements. Contactez l’assistance pour exercer ces droits. Deux limites s’appliquent : les écritures du registre financier ne peuvent être modifiées ni supprimées, et les données déjà inscrites sur une blockchain publique échappent entièrement à notre contrôle.',
            },
          ],
        },
        {
          title: 'Sécurité',
          paragraphs: [
            {
              text: 'L’authentification est gérée par un fournisseur spécialisé. L’autorisation est appliquée dans la base de données elle-même et pas seulement dans l’application, les opérations financières sont exécutées comme des transactions atomiques et les actions privilégiées sont soumises à une limitation de débit et consignées dans un journal d’audit. Aucun système n’est parfaitement sécurisé : utilisez un mot de passe unique et robuste, et protégez votre compte de messagerie.',
            },
          ],
        },
        {
          title: 'Cookies',
          paragraphs: [
            {
              text: 'Nous utilisons uniquement les cookies nécessaires pour maintenir votre connexion et sécuriser votre session. Aucun cookie publicitaire ou de suivi tiers n’est utilisé.',
            },
          ],
        },
        { title: 'Contact', paragraphs: [] },
      ],
    },
  },
}
