/**
 * English dictionary — the reference shape.
 *
 * `Dictionary` is derived from this object, so every other language file is
 * type-checked against it. A missing or misspelled key fails `npm run
 * typecheck`, which means a half-translated release cannot be built.
 *
 * Values that take arguments are written as functions rather than templates
 * with placeholders: the compiler then also checks the arguments.
 */
export const en = {
  locale: {
    label: 'Language',
    switchTo: 'Switch language',
  },

  common: {
    usdt: 'USDT',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied',
    none: 'None',
    dash: '—',
    all: 'All',
    date: 'Date',
    type: 'Type',
    amount: 'Amount',
    status: 'Status',
    details: 'Details',
    member: 'Member',
    active: 'Active',
    inactive: 'Inactive',
    previous: 'Previous',
    next: 'Next',
    pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
    signOut: 'Sign out',
    viewAll: 'View all',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    unread: 'Unread',
  },

  nav: {
    dashboard: 'Dashboard',
    tasks: 'Tasks',
    vip: 'VIP tiers',
    wallet: 'Wallet',
    team: 'Team',
    history: 'History',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    notifications: 'Notifications',
    profile: 'Profile',
    admin: 'Admin',
    sectionAccount: 'Account',
    sectionOperations: 'Operations',
    home: 'Home',
    currentTier: 'Current tier',
    noActivePlan: 'No active plan',
    activatePrompt: 'Activate one to earn rewards →',
    tasksPerDay: (n: number) => `${n} tasks / day`,
    activated: (amount: string) => `${amount} activated`,
    notificationsAria: (unread: number) =>
      unread > 0 ? `Notifications, ${unread} unread` : 'Notifications',
    statusStrip: 'Session active — internal platform ledger',
    statusStripRight: 'Amounts in USDT · resets 00:00 UTC',
  },

  publicSite: {
    howItWorks: 'How it works',
    terms: 'Terms',
    privacy: 'Privacy',
    termsOfService: 'Terms of service',
    privacyPolicy: 'Privacy policy',
    signIn: 'Sign in',
    register: 'Register',
    footerBlurb:
      'An invitation-only platform for property listing verification tasks.',
    disclaimer:
      'PropVerify is not a bank, a broker, a custodian or a licensed financial institution, and it is not supervised by a financial regulator. It does not offer investment products and makes no promise of profit or return. Task rewards are discretionary platform payments for completed verification work and are set by configurable parameters that the operator can change. Digital assets are volatile and transfers on public blockchains are irreversible. Only participate with funds you can afford to lose.',
  },

  home: {
    badge: 'Invitation only',
    headlineTop: 'Every listing deserves',
    headlineAccent: 'a real second look.',
    intro:
      'Members verify a small batch of property listings each day — photos, location, amenities, listing quality — and receive a platform reward written into a ledger you can read line by line. Deposits are real USDT transfers verified on chain.',
    ctaPrimary: 'Create my account',
    ctaSecondary: 'See a task in 40 s',
    inviteNote: 'You need an invitation code from an existing member. There is no open sign-up.',
    figureTasks: 'Tasks per day',
    figureWindow: 'Per verification',
    figureTasksValue: '3',
    figureWindowValue: '180 s',
    figureChecks: 'Deposit checks',
    figureChecksValue: 'On chain',
    plateHint: 'Photo · location · amenities',
    checklistTitle: 'Verification checklist',
    checklist: [
      'Photos match the property',
      'Address confirmed on the map',
      'Amenities present in the listing',
    ],
    pillars: [
      {
        title: 'A ledger, not a promise',
        body: 'Every cent in and out is an immutable entry you can read back line by line, with its source attached.',
      },
      {
        title: 'Deposits verified on chain',
        body: 'Hash, network, destination, token contract, amount and confirmations are all checked before any credit.',
      },
      {
        title: 'Withdrawals settled by hand',
        body: 'An operator sends the payment from an external wallet and records the hash. No private key lives here.',
      },
    ],
    plainTitle: 'What this platform is, in plain terms',
    plainSubtitle: 'We would rather be blunt up front than have you find out later.',
    trueTitle: 'What is true',
    trueItems: [
      'Deposits are genuine blockchain transactions to a platform wallet address.',
      'Every deposit is verified against the chain — transaction hash, network, destination, token contract, amount and confirmations — before anything is credited.',
      'The balance in your dashboard is an internal platform ledger balance. Every change to it is an immutable accounting entry you can inspect.',
      'Withdrawals are paid manually by an operator, and the real transaction hash is shown to you.',
    ],
    warningTitle: '🚀 Be Part of Something Bigger',
    warningBody:
      'Take the first step today, participate with confidence, and be part of our journey from the beginning, explore how you can become part of our growing business',
    howTitle: 'How it works',
    step: (n: number) => `Step ${n}`,
    steps: [
      {
        title: 'Join by invitation',
        body: 'Register with a code from an existing member. Your inviter is fixed at registration and cannot be changed later.',
      },
      {
        title: 'Deposit USDT',
        body: 'Send USDT to the displayed platform address on a supported network. We verify the transaction on chain and credit the verified amount.',
      },
      {
        title: 'Activate a plan',
        body: "A plan sets how many tasks you can complete per day and the reward parameters used to calculate each task's payment.",
      },
      {
        title: 'Complete daily tasks',
        body: 'Work through your daily verification tasks. Each has a timed review window measured by our server.',
      },
      {
        title: 'Claim rewards',
        body: 'After the window elapses, claim the reward. The amount is computed on the server and written to your ledger.',
      },
      {
        title: 'Withdraw',
        body: 'Request a withdrawal to your own wallet. Timing rules apply. An operator sends the payment and records the transaction hash.',
      },
    ],
    ctaTitle: 'Have an invitation code?',
    ctaBodyBefore: 'Read the ',
    ctaFaq: 'FAQ',
    ctaBodyMiddle: ' and the ',
    ctaTerms: 'terms',
    ctaBodyAfter: ' first. They spell out the withdrawal rules and the risks.',
    ctaButton: 'Create your account',
  },

  auth: {
    signInTitle: 'Sign in',
    signInSubtitle: 'Welcome back to PropVerify.',
    noAccount: 'No account yet?',
    registerLink: 'Register with an invitation',
    haveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    registerTitle: 'Create your account',
    registerSubtitle: 'PropVerify is invitation-only. You need a code from an existing member.',
    invalidInviteTitle: 'That invitation link is not valid',
    invalidInviteBody: (code: string) =>
      `The code ${code} does not belong to an active member. Ask your inviter for a current link, or enter a different code below.`,
    inviteAccepted: (code: string) => `Invitation code ${code} accepted.`,
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    username: 'Username',
    invitationCode: 'Invitation code',
    signingIn: 'Signing in…',
    creatingAccount: 'Creating your account…',
    createAccount: 'Create account',
  },

  dashboard: {
    welcome: (name: string) => `Welcome back, ${name}`,
    intro: 'Here is the current state of your account. Every figure below is an internal platform ledger balance.',
    accountSuspended: (status: string) => `Your account is ${status}`,
    accountSuspendedBody:
      'Tasks, deposits and withdrawals are disabled while your account is in this state. Contact support for details.',
    balanceLabel: 'Internal platform balance · ledger',
    balanceNote:
      "This is not an on-chain balance. It is a figure held in the platform's internal ledger, backed by your verified deposits and the rewards recorded against your account. Every movement is auditable.",
    viewLedger: 'View ledger →',
    movementLabel: 'Recent ledger movement',
    movementCount: (n: number) => `${n} entries`,
    today: 'Today',
    taskProgress: 'Task progress',
    tasksUnit: 'tasks',
    earnedToday: 'Earned today',
    currentTier: 'Current tier',
    openTasks: 'Open daily tasks',
    allTasksDone: 'All tasks completed',
    totalRewards: 'Total rewards',
    totalRewardsSub: 'Credited to your ledger',
    totalDeposited: 'Total deposited',
    totalDepositedSub: 'Verified on chain',
    totalWithdrawn: 'Total withdrawn',
    totalWithdrawnSub: 'Settled manually',
    pendingWithdrawal: 'Pending withdrawal',
    pendingWithdrawalSub: 'Held while under review',
    activatePlanTitle: 'Activate a plan to start earning task rewards',
    activatePlanBody:
      'Task rewards are only paid to accounts with an active VIP plan. Activation is charged from your internal platform balance.',
    viewPlans: 'View plans',
    depositUsdt: 'Deposit USDT',
    firstWithdrawalTitle: 'First withdrawal not available yet',
    firstWithdrawalBody: (days: number, waitDays: number, cooldown: number) =>
      `Your first withdrawal unlocks ${days} day${days === 1 ? '' : 's'} from now, ${waitDays} days after your plan activation. After that you may withdraw once every ${cooldown} days.`,
    unreadNotifications: 'Unread notifications',
    recentLedger: 'Recent ledger',
    fullHistory: 'Full history',
    noActivityTitle: 'No activity yet',
    noActivityBody: 'Your ledger will show every deposit, reward and withdrawal as soon as they happen.',
    firstDeposit: 'Make your first deposit',
    yourTeam: 'Your team',
    open: 'Open',
    totalMembers: 'Total members',
    direct: 'Direct',
    level: (n: number) => `Level ${n}`,
    commissionNote:
      "Commission is paid from VIP activation fees collected by the platform, at rates the operator configures. It is not a share of another member's deposit.",
  },

  tasks: {
    eyebrow: (n: number) => `${n} listing${n === 1 ? '' : 's'} in today's batch`,
    titleWaiting: (n: number) => `${n} listing${n === 1 ? '' : 's'} waiting for you`,
    titlePlain: 'Daily tasks',
    description: (seconds: number) =>
      `Your task set resets every day at 00:00 UTC. Each task runs a ${seconds}-second verification window measured on the server — the countdown on screen is only an indication.`,
    completedToday: 'Completed today',
    earnedToday: 'Earned today',
    availableToday: 'Available today',
    basedOn: (plan: string) => `Based on ${plan}`,
    requiresPlan: 'Requires an active plan',
    disabledTitle: 'Tasks are disabled',
    disabledBody: (status: string) => `Your account is ${status}. Contact support for details.`,
    needPlanTitle: 'Activate a VIP plan to claim rewards',
    needPlanBody:
      "You can view today's tasks, but rewards can only be claimed with an active plan. The reward amount is derived from your plan's configured task reward parameters.",
    noTasksTitle: 'No tasks available',
    noTasksBody: 'No active tasks are configured right now. Please check back later.',
    howTitle: 'How task rewards work',
    howItems: (limit: number) => [
      'Rewards are internal platform rewards credited to your platform ledger balance, not on-chain payments.',
      'The reward amount is calculated on the server from your active plan when you claim, never from your browser.',
      'The timer is enforced by the database. Claiming before the window has elapsed is rejected regardless of what your screen shows.',
      `You can complete at most ${limit} tasks per day, and each task can be rewarded only once per day.`,
    ],
    card: {
      lot: (n: string) => `Lot #${n}`,
      noPhoto: 'No photo',
      enlarge: (title: string) => `Enlarge the photo for ${title}`,
      collapse: (title: string) => `Collapse the photo for ${title}`,
      clickEnlarge: 'Click to enlarge',
      clickShrink: 'Click to shrink',
      counter: (slot: number, total: number) => `Task ${slot} / ${total}`,
      difficulty: { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' },
      completed: 'Completed',
      reward: 'Reward',
      earned: 'Earned',
      windowOpen: 'Verification window',
      windowDone: 'Verification window complete',
      secondsRemaining: (n: number) => `${n} seconds remaining`,
      claimed: 'Reward claimed',
      claiming: 'Claiming…',
      claim: (amount: string) => `Claim ${amount}`,
      claimIn: (amount: string, time: string) => `Claim ${amount} · ${time}`,
      starting: 'Starting…',
      start: 'Start verification →',
      needPlan: 'An active VIP plan is required before a reward can be claimed.',
      recorded: 'Recorded in your ledger.',
      windowNote: (seconds: number) => `Window of ${seconds}s measured on the server.`,
    },
  },

  vip: {
    title: 'VIP plans',
    description:
      'Activating a plan sets your daily task allowance and the task reward parameters used to calculate what each completed task pays.',
    addFunds: 'Add funds',
    current: 'Current',
    activationAmount: 'Activation amount',
    dailyTasks: 'Daily tasks',
    rewardPerTask: 'Reward per task',
    dailyBudget: 'Daily task reward budget',
    historyTitle: 'Your activation history',
    noHistory: 'You have not activated a plan yet.',
    from: 'From',
    to: 'To',
    charged: 'Charged',
    historyNote:
      'Rewards already claimed under a previous plan are never recalculated. Each task assignment keeps the reward it was paid, and every ledger entry is immutable.',
    activePlan: 'Active plan',
    lowerThanCurrent: 'Lower than your current plan',
    activating: 'Activating…',
    confirmBody: (amount: string, plan: string) =>
      `${amount} will be deducted from your internal platform balance to activate ${plan}. This is recorded as a VIP_ACTIVATION entry in your ledger and cannot be reversed automatically.`,
    needMore: (amount: string) => `Need ${amount} more`,
    activateFor: (amount: string) => `Activate for ${amount}`,
    insufficient: 'Insufficient internal platform balance',
  },

  wallet: {
    title: 'Wallet',
    description: 'Your internal platform ledger. Every movement below is an immutable accounting entry.',
    balanceLabel: 'Internal Platform Balance',
    balanceNote:
      "Held in the platform's internal ledger, not in a blockchain wallet you control. Deposits are credited only after the transaction has been verified on chain; withdrawals are executed manually by the operations team from an external wallet.",
    todaysRewards: "Today's rewards",
    totalRewards: 'Total rewards',
    totalDeposited: 'Total deposited',
    chainVerified: 'Chain verified',
    totalWithdrawn: 'Total withdrawn',
    pendingWithdrawal: 'Pending withdrawal',
    lockedUntilSettled: 'Locked until settled',
    nothingLocked: 'Nothing locked',
    totalBalance: 'Total balance',
    availablePlusLocked: 'Available plus locked',
    lockedTitle: 'Funds are locked for a withdrawal request',
    lockedBody: (amount: string) =>
      `${amount} is held aside for a withdrawal that has not been settled yet. It is removed from your available balance so it cannot be spent twice.`,
    recentMovements: 'Recent movements',
  },

  history: {
    title: 'Ledger history',
    description: (total: number) =>
      `${total} entr${total === 1 ? 'y' : 'ies'}. The ledger is append-only: corrections appear as new entries, never as edits.`,
    pagination: 'Pagination',
  },

  ledgerTable: {
    empty: 'No ledger entries yet.',
    balanceAfter: 'Balance after',
  },

  ledgerTypes: {
    DEPOSIT: 'Deposit',
    TASK_REWARD: 'Task reward',
    REFERRAL_REWARD: 'Referral commission',
    VIP_ACTIVATION: 'VIP activation',
    WITHDRAWAL_HOLD: 'Withdrawal locked',
    WITHDRAWAL_RELEASE: 'Withdrawal released',
    WITHDRAWAL_COMPLETED: 'Withdrawal paid',
    ADMIN_ADJUSTMENT: 'Adjustment',
    REFUND: 'Refund',
  },

  statuses: {
    deposit: { PENDING: 'Pending', CONFIRMED: 'Confirmed', REJECTED: 'Rejected' },
    withdrawal: {
      PENDING: 'Pending',
      PROCESSING: 'Processing',
      PAID: 'Paid',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
    },
    assignment: {
      AVAILABLE: 'Available',
      STARTED: 'Started',
      SUBMITTED: 'Submitted',
      COMPLETED: 'Completed',
      REJECTED: 'Rejected',
      EXPIRED: 'Expired',
    },
    user: { ACTIVE: 'Active', SUSPENDED: 'Suspended', BANNED: 'Banned' },
    notification: { INFO: 'Info', SUCCESS: 'Success', WARNING: 'Warning', ERROR: 'Error' },
  },

  notifications: {
    title: 'Notifications',
    unreadCount: (n: number) => `${n} unread`,
    allCaughtUp: 'You are all caught up.',
    markAllRead: 'Mark all as read',
    markRead: 'Mark read',
    emptyTitle: 'Nothing here yet',
    emptyBody:
      'Deposits, task rewards, referral activity and withdrawal updates all show up on this page.',
  },

  profile: {
    title: 'Profile',
    description: 'Your account details and security settings.',
    account: 'Account',
    email: 'Email',
    username: 'Username',
    role: 'Role',
    roleMember: 'Member',
    invitationCode: 'Invitation code',
    currentPlan: 'Current plan',
    memberSince: 'Member since',
    firstActivation: 'First activation',
    notActivated: 'Not activated yet',
    twoFactor: 'Two-factor authentication',
    enabled: 'Enabled',
    notEnabled: 'Not enabled',
    changeUsername: 'Change username',
    changePassword: 'Change password',
    usernameHint: 'Shown to your team members. 3 to 24 characters.',
    saveUsername: 'Save username',
    saving: 'Saving…',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmNewPassword: 'Confirm new password',
    passwordHint: 'At least 10 characters, with an uppercase letter, a lowercase letter and a number.',
    updatePassword: 'Update password',
    updating: 'Updating…',
    immutableTitle: 'Things that cannot be changed',
    immutableItems: [
      'Your invitation code, so existing invitation links keep working.',
      'Who invited you. The referral relationship is fixed at registration and enforced by the database.',
      'Your ledger entries. Every balance change is permanent; corrections are added as new entries.',
    ],
  },

  team: {
    title: 'My team',
    description: 'Registration is invitation-only. Anyone who signs up with your link joins your team.',
    yourInvitation: 'Your invitation',
    invitationCode: 'Invitation code',
    invitationLink: 'Invitation link',
    copyCode: 'Copy code',
    copyLink: 'Copy link',
    totalTeam: 'Total team',
    acrossLevels: 'Across all three levels',
    levelDirect: 'Level 1 (direct)',
    level2: 'Level 2',
    level3: 'Level 3',
    commissionPercent: (p: string) => `${p}% commission`,
    commissionEarned: 'Commission earned',
    commissionEarnedSub: 'Paid into your internal platform balance',
    activeMembers: 'Members with an active plan',
    ofTotal: (n: number) => `of ${n} total`,
    fundingTitle: 'How referral commission is funded',
    fundingBody:
      "Commission is a share of revenue the platform actually collects: when a team member activates a VIP plan, a configured percentage of that activation fee is credited to their upline. Nothing is paid out of another member's deposit, and no commission is generated by deposits alone.",
    disabledNote: ' Referral commissions are currently disabled by the operator.',
    emptyTitle: 'No team members yet',
    emptyBody:
      'Share your invitation link. Anyone who registers with it appears here, along with everyone they invite, up to three levels deep.',
    levelHeading: (n: number) => `Level ${n}`,
    memberCount: (n: number, percent: string) => `${n} member${n === 1 ? '' : 's'} · ${percent}%`,
    joined: 'Joined',
    plan: 'Plan',
    memberFallback: 'Member',
  },

  deposit: {
    title: 'Deposit USDT',
    description:
      'Send real USDT from your own wallet to the platform address below. Your internal platform balance is credited only after the transaction is verified on chain.',
    readFirstTitle: 'Read before sending',
    readFirstItems: [
      'Send only the token shown, on the exact network shown. Anything else is unrecoverable.',
      'Deposits are credited with the amount that actually arrives on chain, not the amount you type here.',
      'Crediting happens after the required number of confirmations, which can take several minutes.',
    ],
    newDeposit: 'New deposit',
    noneInProgressTitle: 'No deposit in progress',
    noneInProgressBody: 'Create a deposit to see the address you should send to.',
    sendOn: (amount: string, network: string) => `Send ${amount} on ${network}`,
    reference: (code: string, created: string) => `Reference ${code} · created ${created}`,
    qrAlt: (network: string) => `QR code for the ${network} deposit address`,
    platformAddress: 'Platform deposit address',
    network: 'Network',
    token: 'Token',
    tokenContract: 'Token contract',
    confirmationsRequired: 'Confirmations required',
    confirmationsCurrent: 'Current confirmations',
    noAddress: 'No active deposit address is configured for this network.',
    submittedTx: 'Submitted transaction',
    waitingVerification: (seen: number, needed: number) =>
      `Waiting for verification. ${seen}/${needed} confirmations seen.`,
    alreadySent: 'Already sent the funds?',
    historyTitle: 'Deposit history',
    noDeposits: 'No deposits yet.',
    declared: 'Declared',
    credited: 'Credited',
    transaction: 'Transaction',
    notSubmitted: 'Not submitted',
    form: {
      unavailableTitle: 'Deposits are not available yet',
      unavailableBody:
        'No deposit address has been configured for any network. Contact support before sending any funds.',
      errorTitle: 'Could not create deposit instructions',
      currency: 'Currency',
      network: 'Network',
      amount: 'Amount',
      unavailableSuffix: ' — unavailable',
      disabledSuffix: ' — disabled',
      amountHint: (minimum: string, confirmations: number) =>
        `Minimum ${minimum}. ${confirmations} confirmations are required before crediting.`,
      creating: 'Creating…',
      submit: 'Get deposit instructions',
      note: 'The amount you enter is a note for your own tracking. Your balance is credited with the amount actually received on chain, which may differ if you send a different value.',
      txId: 'TXID',
      txIdGuideTitle: 'Where can I find my TXID?',
      txIdGuideBody:
        'After sending the funds, copy the TXID from the withdrawal details in your wallet or from the confirmation email you receive after the transaction.',
      txIdDetailsCaption: 'Withdrawal details',
      txIdEmailCaption: 'Confirmation email',
      txIdDetailsImageAlt: 'Example showing the TXID in withdrawal details',
      txIdEmailImageAlt: 'Example showing the TXID in a transaction confirmation email',
      txHash: 'Transaction hash',
      txHashHint: 'Paste the hash from your wallet or from the block explorer after the transfer is broadcast.',
      verifying: 'Verifying on chain…',
      submitTx: 'Submit and verify',
      checking: 'Checking…',
      recheck: 'Check status again',
    },
  },

  withdraw: {
    title: 'Withdraw',
    description:
      'Withdrawals are paid manually by the operations team from an external wallet. The platform never holds a private key and never signs a transaction automatically.',
    available: 'Available',
    lockedInRequests: 'Locked in requests',
    totalWithdrawn: 'Total withdrawn',
    scheduleTitle: 'Withdrawal schedule',
    eligibleNow: 'Eligible now',
    notEligible: 'Not eligible yet',
    firstWithdrawal: 'First withdrawal',
    daysAfterActivation: (days: number) => `${days} days after activation`,
    then: 'Then',
    onceEvery: (days: number) => `once every ${days} days`,
    unlocksOn: 'Unlocks on',
    nextWindow: 'Next window',
    notStarted: 'Not started',
    serverClockNote:
      'These rules are enforced by the server using its own clock. Changing your device time has no effect.',
    reasons: {
      NO_ACTIVATION:
        'The waiting period is measured from your first VIP activation. Activate a plan to start the clock.',
      ACCOUNT_NOT_ACTIVE: 'Your account is not active. Contact support for details.',
      WITHDRAWAL_ALREADY_PENDING: 'You already have a withdrawal in progress. Only one can be open at a time.',
      COOLDOWN_ACTIVE: 'Your cooldown after the previous paid withdrawal has not finished yet.',
      FIRST_WITHDRAWAL_WAITING_PERIOD: 'Your first withdrawal has not unlocked yet.',
      GENERIC: 'You are not eligible to withdraw right now.',
    },
    newRequest: 'New withdrawal request',
    settlementTitle: 'How settlement works',
    settlementSteps: [
      {
        title: 'Request',
        body: 'The amount leaves your available balance immediately and is held as a pending withdrawal, so it cannot be spent twice.',
      },
      {
        title: 'Review',
        body: 'An operator reviews the request. If it is rejected, the full amount is returned to your available balance.',
      },
      {
        title: 'Manual payment',
        body: 'The operator sends the USDT from an external wallet, outside this application.',
      },
      {
        title: 'Recorded',
        body: 'The resulting transaction hash is recorded against your withdrawal and shown to you here, and the ledger is closed with a WITHDRAWAL_COMPLETED entry.',
      },
    ],
    fee: 'Fee',
    requested: 'Requested',
    destination: 'Destination',
    historyTitle: 'Withdrawal history',
    noWithdrawals: 'No withdrawals yet.',
    availableInDays: (days: number) => `Available in ${days} day${days === 1 ? '' : 's'}.`,
    unavailable: 'Withdrawal unavailable.',
    openRequest: 'Open request',
    form: {
      notAvailableTitle: 'Withdrawal not available',
      requestReceived: 'Request received',
      requestRejected: 'Request rejected',
      amount: 'Amount',
      amountHint: (available: string, minimum?: string, fee?: string) =>
        minimum && fee
          ? `Available: ${available} · Minimum: ${minimum} · Network fee: ${fee}`
          : `Available: ${available}`,
      network: 'Network',
      disabledSuffix: ' — disabled',
      destination: 'Destination wallet address',
      destinationHint: 'Double-check it: manual payments cannot be reversed.',
      youReceive: 'You receive',
      deducted: 'Deducted from balance',
      submitting: 'Submitting…',
      submit: 'Request withdrawal',
      note: 'On submission the amount is locked immediately and removed from your available balance. Payment is executed manually by the operations team from an external wallet; the transaction hash appears here once it has been sent.',
      cancelRequest: 'Cancel request',
      confirmCancel: 'Cancel and unlock the funds?',
      cancelling: 'Cancelling…',
      yesCancel: 'Yes, cancel',
      keep: 'Keep',
    },
  },

  authForms: {
    accountCreated: 'Account created',
    confirmationSent: (email: string) => `We sent a confirmation link to ${email}. Open it, then sign in.`,
    goToSignIn: 'Go to sign in',
    inviteHint: 'Registration is invitation-only. Ask the member who invited you for their code.',
    usernameHint: '3 to 24 characters.',
    passwordHint: 'At least 10 characters, with an uppercase letter, a lowercase letter and a number.',
    acceptBefore: 'I have read and accept the ',
    acceptTerms: 'terms',
    acceptMiddle: ' and ',
    acceptPrivacy: 'privacy policy',
    acceptAfter:
      ', and I understand that my dashboard balance is an internal platform ledger balance, not an on-chain wallet.',

    /* Email confirmation. Shown when Supabase requires a confirmed address
       before the account can be used. */
    notConfirmedTitle: 'Confirm your email address first',
    notConfirmedBody:
      'This account still needs to be confirmed. Open the confirmation link we emailed you, then sign in.',
    resendEmailLabel: 'Your email address',
    resendButton: 'Resend the confirmation email',
    resendSending: 'Sending…',
    confirmTitle: 'Confirm your email address',
    confirmLead: 'Your account was created, but it is not usable yet. We sent a confirmation link to',
    confirmStep1: 'Open your inbox and find the message from us. Check the spam folder if it is not there.',
    confirmStep2: 'Click the confirmation link.',
    confirmStep3: 'Come back and sign in. Signing in before that will be refused.',
    nothingArrived: 'Nothing arrived?',
    confirmedGoSignIn: 'I have confirmed my email, take me to sign in',
  },

  legal: {
    faq: {
      title: 'How it works',
      intro:
        'Plain answers, including the ones that are not flattering. If anything here contradicts what someone told you about the platform, this page is what the software actually does.',
      warnTitle: 'Read this first',
      warnBody:
        'Your dashboard balance is an internal platform ledger balance, not an on-chain wallet balance. Task rewards are discretionary platform payments for completed work, not investment returns, and nothing here is guaranteed.',
      ctaRegister: 'Register with an invitation',
      ctaTerms: 'Terms of service',
      sections: [
        {
          heading: 'Joining',
          items: [
            {
              q: 'Why do I need an invitation code?',
              a: 'Registration is invitation-only. You need a referral code from an existing active member, which arrives as a link in the form /register?ref=ABC123. The code is validated on the server before an account is created; a missing, unknown or suspended code is refused.',
            },
            {
              q: 'Can I change who invited me later?',
              a: 'No. The relationship is recorded once at registration and cannot be edited afterwards, by you or by support. This keeps the referral structure honest.',
            },
            {
              q: 'What do I get for inviting people?',
              a: 'When someone in your team activates a VIP level, a configured percentage of that activation fee is credited to you, up to three levels deep. It is a share of revenue the platform has actually collected. Nobody else’s deposit is ever paid out to you, and simply receiving deposits generates no commission.',
            },
          ],
        },
        {
          heading: 'Money',
          items: [
            {
              q: 'How is a deposit credited?',
              a: 'You create a deposit request, send USDT from your own wallet to the address we display, then submit the transaction hash. Our backend looks the transaction up on the chain and checks the hash, the network, the destination address, the token contract, the amount, the confirmation count, and that the same transaction has not already been credited. Only when all of those pass does the amount reach your ledger. What you typed as the amount is never what gets credited — the chain decides.',
            },
            {
              q: 'Several people use the same deposit address. Will my funds be mixed up?',
              a: 'No. Deposits are identified by the transaction itself, never by the amount. A transaction hash can only ever be credited once, enforced by a unique constraint in the database.',
            },
          ],
        },
        {
          heading: 'VIP and tasks',
          items: [
            {
              q: 'What does activating a VIP level do?',
              a: 'It charges the activation amount from your internal balance and sets the parameters used to calculate your future task rewards. Rewards already credited are never recalculated when you change level.',
            },
            {
              q: 'Is the reward rate a guaranteed return on my money?',
              a: 'No. It is a configurable parameter that determines the size of the reward pool for a day of completed tasks. The operator can change it. It is payment for work you do on the platform, not investment income, and there is no guarantee attached to it.',
            },
            {
              q: 'How do the daily tasks work?',
              a: 'You get three tasks per UTC day. You start a task, a three-minute timer runs, and once it has elapsed you can claim the reward. The countdown you see is only a display: the backend checks the real elapsed time against its own clock, so closing the tab, changing your device time or editing the page does nothing. A fourth task in the same day cannot be claimed, and no task can be claimed twice.',
            },
            {
              q: 'When do new tasks appear?',
              a: 'At the start of each UTC day. Old assignments are kept permanently as history, never deleted.',
            },
          ],
        },
        {
          heading: 'Withdrawal timing',
          items: [
            {
              q: 'When can I make my first withdrawal?',
              a: 'Thirty days after the activation event configured by the operator. Until then the withdrawal page shows how many days remain. The rule is enforced by the server using its own timestamps.',
            },
            {
              q: 'And afterwards?',
              a: 'One withdrawal every ten days, counted from your last completed withdrawal. Both the waiting period and the cooldown are configurable by the operator, and the values in force are shown to you on the withdrawal page.',
            },
            {
              q: 'What happens to the money while a request is open?',
              a: 'It is locked immediately: the amount moves out of your available balance into a pending balance, recorded as a ledger entry. If the request is rejected or cancelled the lock is released back to you; if it is paid, the lock is converted into a completed withdrawal. This is what stops the same balance being spent twice.',
            },
          ],
        },
      ],
    },

    terms: {
      title: 'Terms of service',
      templateNote:
        'These terms are a template supplied with the software. Before operating this platform commercially, have them reviewed and adapted by a qualified lawyer in your jurisdiction.',
      contactBefore: 'Support requests should be sent to the address published in the application. See also our ',
      contactPrivacy: 'privacy policy',
      contactMiddle: ' and ',
      contactFaq: 'how it works',
      contactAfter: '.',
      sections: [
        {
          title: 'Acceptance',
          paragraphs: [
            'By registering or using the platform you agree to these terms. If you do not agree, do not register. You must be of legal age in your jurisdiction and legally permitted to use a service of this kind.',
          ],
        },
        {
          title: 'Invitation-only access',
          paragraphs: [
            'Accounts can only be created with a valid invitation code from an existing active member. The referral relationship is recorded once, at registration, and cannot subsequently be changed. Attempting to manipulate the referral structure — self-referral, duplicate accounts, automated registration — is grounds for suspension and forfeiture.',
          ],
        },
        {
          title: 'Your account',
          paragraphs: [
            'One account per person. You are responsible for the security of your credentials and for all activity under your account. Provide accurate information and keep it current. We may suspend or terminate accounts that breach these terms, are used unlawfully, or that we reasonably believe to be fraudulent.',
          ],
        },
        {
          title: 'Deposits',
          paragraphs: [
            'Deposits are real transfers of digital assets on public blockchains, sent by you from a wallet you control to an address we display. We credit your internal balance only after verifying the transaction against the chain: hash, network, destination address, token contract, amount and confirmation depth, and that the transaction has not previously been credited.',
            'Blockchain transfers are irreversible. Sending the wrong asset, using the wrong network, or sending to an address other than the one displayed will in most cases result in permanent loss that we cannot recover for you.',
          ],
        },
        {
          title: 'VIP levels and task rewards',
          paragraphs: [
            'Activating a level charges the stated amount from your internal balance and determines the parameters used to calculate rewards for tasks you complete afterwards. Rewards already credited are never recalculated.',
            'Reward rates are configurable operational parameters set by the operator and may be changed at any time. They are payment for verification work completed on the platform. They are not interest, not a yield, not a dividend and not a guaranteed or projected return on any amount you have deposited.',
          ],
        },
        {
          title: 'Tasks',
          paragraphs: [
            'Each active member is issued a limited number of verification tasks per UTC day. A task must be started and its timer must have elapsed, as measured by our servers, before its reward can be claimed. Rewards are calculated server-side. Any attempt to claim a reward without performing the task, to claim the same reward twice, to exceed the daily limit, or to manipulate timers or reward amounts from the client will void the reward and may result in suspension.',
          ],
        },
        {
          title: 'Referral commission',
          paragraphs: [
            'Commission is a configurable share of the VIP activation fees the operator actually collects from your team members, paid up to three levels. It is not a share of anyone’s deposit, and no commission arises from recruitment or from deposits alone.',
          ],
        },
        {
          title: 'Prohibited conduct',
          paragraphs: [
            'Do not create multiple accounts, automate task completion, interfere with the service, attempt to access other users’ data, use the platform for money laundering or any unlawful purpose, or misrepresent the platform to others — in particular by describing it as an investment, a bank, a regulated service, or as offering guaranteed returns.',
          ],
        },
        {
          title: 'Availability and changes',
          paragraphs: [
            'The service is provided on an "as is" basis without warranties of any kind. We may modify, suspend or discontinue any part of it, and may change these terms; material changes will be announced in the application. Continued use after a change constitutes acceptance.',
          ],
        },
        {
          title: 'Limitation of liability',
          paragraphs: [
            'To the maximum extent permitted by law, the operator is not liable for indirect, incidental or consequential losses, for lost profits, or for losses arising from blockchain network conditions, your own errors in addresses or networks, or unauthorised access to your account resulting from your failure to protect your credentials.',
          ],
        },
        {
          title: 'Termination',
          paragraphs: [
            'You may stop using the platform at any time. We may suspend or close an account for breach of these terms. Where an account is closed without breach, any remaining internal balance is payable subject to the normal withdrawal rules and review.',
          ],
        },
        { title: 'Contact', paragraphs: [] },
      ],
    },

    privacy: {
      title: 'Privacy policy',
      templateNote:
        'This is a template supplied with the software. Adapt it to your jurisdiction and your actual hosting arrangements before operating publicly.',
      warnTitle: 'Blockchain data is public and permanent',
      warnBody:
        'Any wallet address you use to deposit, and any address you give us for a withdrawal, becomes part of a public blockchain record that we cannot edit or erase. Deleting your account does not remove it.',
      contactBefore: 'Questions about this policy can be sent to the support address published in the application. See also our ',
      contactTerms: 'terms of service',
      contactAfter: '.',
      sections: [
        {
          title: 'What we collect',
          paragraphs: [
            {
              label: 'Account data:',
              text: ' email address, chosen username, hashed password (handled by our authentication provider — we never see or store your password), your referral code and the code you registered with.',
            },
            {
              label: 'Financial records:',
              text: ' deposit requests, transaction hashes, verified amounts, sending and receiving addresses, withdrawal requests and destination addresses, and every entry in your internal ledger.',
            },
            {
              label: 'Activity data:',
              text: ' task assignments and completion times, VIP activations, notifications, and timestamps of these events.',
            },
            {
              label: 'Technical data:',
              text: ' IP address and user agent, used for rate limiting, abuse prevention and security logging.',
            },
          ],
        },
        {
          title: 'Why we use it',
          paragraphs: [
            {
              text: 'To operate your account, verify deposits against the blockchain, calculate and pay rewards, process withdrawals, enforce the daily task limits and withdrawal rules, prevent fraud and abuse, and meet legal obligations.',
            },
            { text: 'We do not sell your personal data, and we do not use it for advertising or behavioural profiling.' },
          ],
        },
        {
          title: 'Who can see it',
          paragraphs: [
            {
              text: 'Access is restricted by database row-level security: signed-in users can read only their own profile, balances, deposits, withdrawals, tasks, ledger and notifications. Other members of your team are shown to you with their email addresses masked. Administrators can access account and financial records where necessary to operate the platform and to investigate abuse; every privileged action is recorded in an audit log.',
            },
            {
              text: 'We share data with our infrastructure providers (application hosting, database and authentication) and with public blockchain APIs when we verify a transaction hash you have submitted. We disclose data to authorities only where legally required.',
            },
          ],
        },
        {
          title: 'Retention',
          paragraphs: [
            {
              text: 'Financial and ledger records are retained permanently: the ledger is append-only by design and cannot be edited or deleted, which is what makes balances auditable. Task history is likewise kept rather than purged. Account data is retained while your account exists and for as long afterwards as we are required to keep it.',
            },
          ],
        },
        {
          title: 'Your rights',
          paragraphs: [
            {
              text: 'Depending on where you live you may have the right to access, correct, export or erase your personal data, and to object to certain processing. Contact support to exercise them. Note two limits: entries in the financial ledger cannot be altered or removed, and data already written to a public blockchain is outside our control entirely.',
            },
          ],
        },
        {
          title: 'Security',
          paragraphs: [
            {
              text: 'Authentication is handled by a managed provider. Authorisation is enforced in the database itself rather than only in the application, financial operations run as atomic transactions, and privileged actions are rate limited and audit logged. No system is perfectly secure: use a unique, strong password and keep your email account protected.',
            },
          ],
        },
        {
          title: 'Cookies',
          paragraphs: [
            {
              text: 'We use only the cookies required to keep you signed in and to maintain your session securely. There are no advertising or third-party tracking cookies.',
            },
          ],
        },
        { title: 'Contact', paragraphs: [] },
      ],
    },
  },
}

export type Dictionary = typeof en
