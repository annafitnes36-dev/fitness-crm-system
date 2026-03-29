import { useState, useCallback, useEffect } from 'react';

export type ClientCategory = 'new' | 'loyal' | 'sleeping' | 'lost';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
}

export interface Hall {
  id: string;
  name: string;
  capacity: number;
  branchId: string;
}

export interface Trainer {
  id: string;
  name: string;
  specialty: string;
  branchId: string;        // основной филиал
  branchIds: string[];     // все филиалы где доступен тренер
}

export interface TrainingCategory {
  id: string;
  name: string;
  color: string;
}

export interface TrainingType {
  id: string;
  name: string;
  duration: number;
  description: string;
  trainerIds: string[];
  branchIds: string[];
  color: string;
  categoryId?: string;
  // Доплата: если задана — при отметке "пришёл" требуется провести дополнительную продажу
  extraPrice?: number | null;
  extraPriceName?: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  sessionsLimit: number | 'unlimited';
  trainingTypeIds: string[];
  allDirections: boolean;
  freezeDays: number;
  branchId: string;
  // Срок автоактивации: кол-во дней с момента покупки, после которых абонемент активируется автоматически
  // Если null — активируется при покупке сразу
  autoActivateDays: number | null;
}

export interface SingleVisitPlan {
  id: string;
  name: string;
  price: number;
  trainingTypeIds: string[];
  branchId: string;
  // Срок автоактивации разового (дни с покупки до автоактивации), null — сразу
  autoActivateDays: number | null;
  // Если true — при записи по этому посещению доплата за тренировку не требуется
  noExtraCharge?: boolean;
}

export interface Subscription {
  id: string;
  clientId: string;
  planId: string;
  planName: string;
  purchaseDate: string;
  endDate: string;
  sessionsLeft: number | 'unlimited';
  freezeDaysLeft: number;
  frozenFrom: string | null;
  frozenTo: string | null;
  // pending — ожидает первой тренировки для активации; active — активен; frozen — заморожен; expired/returned
  status: 'pending' | 'active' | 'frozen' | 'expired' | 'returned';
  price: number;
  discount: number;
  paymentMethod: 'cash' | 'card';
  branchId: string;
  // дата реальной активации (когда сдвинулась точка отсчёта endDate)
  activatedAt: string | null;
  // дата, после которой автоактивируется если клиент не пришёл (null — уже активен)
  autoActivateDate: string | null;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  contactChannel: 'whatsapp' | 'telegram' | 'phone' | 'instagram' | 'vk';
  referralSource: string;
  adSource: string;
  birthDate: string;
  comment: string;
  branchId: string;
  fromBranchId?: string;
  createdAt: string;
  activeSubscriptionId: string | null;
  importedSpent?: number;
  dashboardExclude?: boolean;
  lastVisitDate?: string;
  importedStatus?: ClientCategory;
}

export interface ScheduleEntry {
  id: string;
  trainingTypeId: string;
  trainerId: string;
  branchId: string;
  date: string;
  time: string;
  maxCapacity: number;
  enrolledClientIds: string[];
  guestCount?: number;     // кол-во «пустых» мест (без клиента в базе)
  hallId?: string;
  isPersonal?: boolean;
  personalClientId?: string;
}

export interface Visit {
  id: string;
  clientId: string;
  scheduleEntryId: string;
  date: string;
  status: 'attended' | 'missed' | 'enrolled' | 'cancelled';
  subscriptionId: string | null;
  isSingleVisit: boolean;
  price: number;
}

export interface Sale {
  id: string;
  clientId: string;
  type: 'subscription' | 'single' | 'extra';
  itemId: string;
  itemName: string;
  price: number;
  discount: number;
  finalPrice: number;
  paymentMethod: 'cash' | 'card';
  date: string;
  branchId: string;
  isFirstSubscription: boolean;
  isReturn: boolean;
  isRenewal: boolean;
}



export interface Inquiry {
  id: string;
  branchId: string;
  date: string;
  channel: string;
  adSource: string;
  note: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  branchId: string;
}

export interface SalesPlanItem {
  planId: string;
  target: number;
}

export interface SalesPlan {
  id: string;
  branchId: string;
  month: string;
  items: SalesPlanItem[];
}

// Плановые значения для отчёта план/факт (по месяцу и филиалу)
export interface MonthlyPlanRow {
  revenue: number;
  expenses: number;
  profit: number;
  additionalSales: number;
  subscriptionSales: number;
  avgCheck: number;
  inquiries: number;
  newbieEnrollments: number;
  newbieAttended: number;
  newbieSales: number;
  convInquiryToEnroll: number;
  convEnrollToAttend: number;
  convAttendToSale: number;
  totalSubscriptionSales: number;
  renewalPotential: number;
  renewals: number;
  convRenewal: number;
  returns: number;
  profitability: number;
}

export interface MonthlyPlan {
  id: string;
  branchId: string;
  month: string; // YYYY-MM
  plan: Partial<MonthlyPlanRow>;
}

export interface ExpensePlan {
  id: string;
  branchId: string;
  month: string; // YYYY-MM
  categoryId: string;
  planAmount: number;
}

export type StaffRole = 'director' | 'manager' | 'admin' | 'trainer' | 'marketer';

export interface Permission {
  // Аналитика и отчёты
  viewDirectorDashboard: boolean;      // Дашборд директора/управляющего
  viewAdminDashboard: boolean;         // Дашборд администратора
  viewFinanceHistory: boolean;         // История финансовых операций
  editDeleteOperations: boolean;       // Изменение/удаление операций
  exportData: boolean;                 // Выгрузка данных
  // Клиенты
  addClients: boolean;                 // Добавление новых клиентов
  viewClientCards: boolean;            // Просмотр карточек клиентов
  viewPhoneNumbers: boolean;           // Видимость телефонных номеров
  // Расписание и продажи
  viewSchedule: boolean;               // Просмотр расписания
  enrollClients: boolean;              // Запись клиентов
  sellSubscriptions: boolean;          // Продажа абонементов
  addExpenses: boolean;                // Внесение расходов
  // Настройки
  manageTrainings: boolean;            // Добавление/редактирование тренировок
  manageSubscriptionPlans: boolean;    // Управление абонементами
  manageStaff: boolean;                // Управление сотрудниками
  manageSettings: boolean;             // Настройки системы (залы, источники)
  manageSalesPlan: boolean;            // Установка плана продаж
  // Пункты меню
  menuAnalytics: boolean;              // Аналитика
  menuReports: boolean;                // Отчёты
  menuDashboard: boolean;              // Дашборд
  menuClients: boolean;                // Клиенты
  menuSchedule: boolean;               // Расписание
  menuSubscriptions: boolean;          // Абонементы
  menuSales: boolean;                  // Продажи
  menuFinance: boolean;                // Финансы
  menuBranches: boolean;               // Филиалы
  menuStaff: boolean;                  // Сотрудники
  menuSettings: boolean;               // Настройки
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
  email: string;
  branchIds: string[];
  permissions: Permission;
  createdAt: string;
  password?: string;
  login?: string;
  inviteToken?: string;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  director: 'Директор',
  manager: 'Управляющий',
  admin: 'Администратор',
  trainer: 'Тренер',
  marketer: 'Маркетолог',
};

const ALL_MENU = { menuAnalytics: true, menuReports: true, menuDashboard: true, menuClients: true, menuSchedule: true, menuSubscriptions: true, menuSales: true, menuFinance: true, menuBranches: true, menuStaff: true, menuSettings: true };

export const DEFAULT_PERMISSIONS: Record<StaffRole, Permission> = {
  director: {
    viewDirectorDashboard: true, viewAdminDashboard: true, viewFinanceHistory: true,
    editDeleteOperations: true, exportData: true, addClients: true, viewClientCards: true,
    viewPhoneNumbers: true, viewSchedule: true, enrollClients: true, sellSubscriptions: true,
    addExpenses: true, manageTrainings: true, manageSubscriptionPlans: true,
    manageStaff: true, manageSettings: true, manageSalesPlan: true,
    ...ALL_MENU,
  },
  manager: {
    viewDirectorDashboard: true, viewAdminDashboard: true, viewFinanceHistory: true,
    editDeleteOperations: false, exportData: true, addClients: true, viewClientCards: true,
    viewPhoneNumbers: true, viewSchedule: true, enrollClients: true, sellSubscriptions: true,
    addExpenses: true, manageTrainings: true, manageSubscriptionPlans: true,
    manageStaff: false, manageSettings: true, manageSalesPlan: true,
    ...ALL_MENU,
  },
  admin: {
    viewDirectorDashboard: false, viewAdminDashboard: true, viewFinanceHistory: false,
    editDeleteOperations: false, exportData: false, addClients: true, viewClientCards: true,
    viewPhoneNumbers: true, viewSchedule: true, enrollClients: true, sellSubscriptions: true,
    addExpenses: false, manageTrainings: false, manageSubscriptionPlans: false,
    manageStaff: false, manageSettings: false, manageSalesPlan: false,
    menuAnalytics: false, menuReports: false, menuDashboard: true, menuClients: true, menuSchedule: true, menuSubscriptions: true, menuSales: true, menuFinance: false, menuBranches: false, menuStaff: false, menuSettings: false,
  },
  trainer: {
    viewDirectorDashboard: false, viewAdminDashboard: false, viewFinanceHistory: false,
    editDeleteOperations: false, exportData: false, addClients: false, viewClientCards: true,
    viewPhoneNumbers: false, viewSchedule: true, enrollClients: false, sellSubscriptions: false,
    addExpenses: false, manageTrainings: false, manageSubscriptionPlans: false,
    manageStaff: false, manageSettings: false, manageSalesPlan: false,
    menuAnalytics: false, menuReports: false, menuDashboard: false, menuClients: false, menuSchedule: true, menuSubscriptions: false, menuSales: false, menuFinance: false, menuBranches: false, menuStaff: false, menuSettings: false,
  },
  marketer: {
    viewDirectorDashboard: true, viewAdminDashboard: true, viewFinanceHistory: false,
    editDeleteOperations: false, exportData: true, addClients: true, viewClientCards: false,
    viewPhoneNumbers: false, viewSchedule: true, enrollClients: false, sellSubscriptions: false,
    addExpenses: false, manageTrainings: false, manageSubscriptionPlans: false,
    manageStaff: false, manageSettings: false, manageSalesPlan: false,
    menuAnalytics: true, menuReports: true, menuDashboard: true, menuClients: true, menuSchedule: true, menuSubscriptions: false, menuSales: false, menuFinance: false, menuBranches: false, menuStaff: false, menuSettings: false,
  },
};

export interface Expense {
  id: string;
  branchId: string;
  categoryId: string;
  amount: number;
  date: string;
  comment: string;
  paymentMethod: 'cash' | 'card';
}

const defaultBranches: Branch[] = [
  { id: 'b1', name: 'Центральный', address: 'ул. Ленина, 1', phone: '+7 (999) 000-00-01' },
  { id: 'b2', name: 'Северный', address: 'пр. Победы, 15', phone: '+7 (999) 000-00-02' },
];

const defaultHalls: Hall[] = [
  { id: 'h1', name: 'Зал 1', capacity: 20, branchId: 'b1' },
  { id: 'h2', name: 'Зал 2 (Танцевальный)', capacity: 30, branchId: 'b1' },
];

const defaultTrainers: Trainer[] = [
  { id: 't1', name: 'Иванова Анна Сергеевна', specialty: 'Йога, Пилатес', branchId: 'b1', branchIds: ['b1'] },
  { id: 't2', name: 'Петров Дмитрий Владимирович', specialty: 'Силовые, Кроссфит', branchId: 'b1', branchIds: ['b1'] },
  { id: 't3', name: 'Сидорова Мария Андреевна', specialty: 'Зумба, Аэробика', branchId: 'b2', branchIds: ['b2'] },
];

const defaultTrainingCategories: TrainingCategory[] = [
  { id: 'tc1', name: 'Растяжка и релаксация', color: '#6366f1' },
  { id: 'tc2', name: 'Силовые', color: '#f59e0b' },
  { id: 'tc3', name: 'Танцы', color: '#ec4899' },
];

const defaultTrainingTypes: TrainingType[] = [
  { id: 'tt1', name: 'Йога', duration: 60, description: 'Занятия для гибкости и расслабления', trainerIds: ['t1'], branchIds: ['b1'], color: '#6366f1', categoryId: 'tc1' },
  { id: 'tt2', name: 'Силовая тренировка', duration: 60, description: 'Работа с весами и собственным весом', trainerIds: ['t2'], branchIds: ['b1'], color: '#f59e0b', categoryId: 'tc2' },
  { id: 'tt3', name: 'Зумба', duration: 45, description: 'Танцевальная аэробика', trainerIds: ['t3'], branchIds: ['b2'], color: '#ec4899', categoryId: 'tc3' },
  { id: 'tt4', name: 'Пилатес', duration: 55, description: 'Укрепление мышц кора', trainerIds: ['t1'], branchIds: ['b1', 'b2'], color: '#10b981', categoryId: 'tc1' },
];

const defaultPlans: SubscriptionPlan[] = [
  { id: 'p1', name: 'Безлимит на месяц', price: 4500, durationDays: 30, sessionsLimit: 'unlimited', trainingTypeIds: [], allDirections: true, freezeDays: 7, branchId: 'b1', autoActivateDays: null },
  { id: 'p2', name: '8 занятий', price: 3200, durationDays: 45, sessionsLimit: 8, trainingTypeIds: ['tt1', 'tt2', 'tt4'], allDirections: false, freezeDays: 5, branchId: 'b1', autoActivateDays: null },
  { id: 'p3', name: '4 занятия', price: 1800, durationDays: 30, sessionsLimit: 4, trainingTypeIds: ['tt1', 'tt2'], allDirections: false, freezeDays: 3, branchId: 'b1', autoActivateDays: null },
  { id: 'p4', name: 'Безлимит Зумба', price: 3000, durationDays: 30, sessionsLimit: 'unlimited', trainingTypeIds: ['tt3'], allDirections: false, freezeDays: 5, branchId: 'b2', autoActivateDays: null },
];

const defaultSingleVisitPlans: SingleVisitPlan[] = [
  { id: 'sv1', name: 'Разовое посещение (Йога)', price: 700, trainingTypeIds: ['tt1'], branchId: 'b1', autoActivateDays: null },
  { id: 'sv2', name: 'Разовое посещение (Силовая)', price: 700, trainingTypeIds: ['tt2'], branchId: 'b1', autoActivateDays: null },
  { id: 'sv3', name: 'Разовое посещение (Зумба)', price: 600, trainingTypeIds: ['tt3'], branchId: 'b2', autoActivateDays: null },
];

const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const defaultClients: Client[] = [
  { id: 'c1', firstName: 'Елена', lastName: 'Смирнова', middleName: 'Александровна', phone: '+7 (916) 123-45-67', contactChannel: 'whatsapp', referralSource: 'Друзья', adSource: 'Instagram', birthDate: '1990-05-15', comment: 'Предпочитает утренние занятия', branchId: 'b1', createdAt: fmt(addDays(today, -120)), activeSubscriptionId: 's1' },
  { id: 'c2', firstName: 'Максим', lastName: 'Козлов', middleName: 'Игоревич', phone: '+7 (925) 234-56-78', contactChannel: 'telegram', referralSource: 'Интернет', adSource: 'VK', birthDate: '1988-11-20', comment: '', branchId: 'b1', createdAt: fmt(addDays(today, -60)), activeSubscriptionId: 's2' },
  { id: 'c3', firstName: 'Ольга', lastName: 'Новикова', middleName: 'Петровна', phone: '+7 (903) 345-67-89', contactChannel: 'phone', referralSource: 'Мимо проходила', adSource: 'Вывеска', birthDate: '1995-03-08', comment: 'Аллергия на молочный протеин', branchId: 'b1', createdAt: fmt(addDays(today, -10)), activeSubscriptionId: null },
  { id: 'c4', firstName: 'Артём', lastName: 'Федоров', middleName: 'Сергеевич', phone: '+7 (977) 456-78-90', contactChannel: 'instagram', referralSource: 'Блогер', adSource: 'Instagram', birthDate: '1992-07-25', comment: '', branchId: 'b2', createdAt: fmt(addDays(today, -200)), activeSubscriptionId: null },
  { id: 'c5', firstName: 'Наталья', lastName: 'Морозова', middleName: 'Юрьевна', phone: '+7 (985) 567-89-01', contactChannel: 'whatsapp', referralSource: 'Подруга', adSource: 'Сарафанное радио', birthDate: '1986-12-01', comment: 'Постоянный клиент, скидка 10%', branchId: 'b1', createdAt: fmt(addDays(today, -365)), activeSubscriptionId: 's3' },
];

const defaultSubscriptions: Subscription[] = [
  { id: 's1', clientId: 'c1', planId: 'p1', planName: 'Безлимит на месяц', purchaseDate: fmt(addDays(today, -20)), endDate: fmt(addDays(today, 10)), sessionsLeft: 'unlimited', freezeDaysLeft: 7, frozenFrom: null, frozenTo: null, status: 'active', price: 4500, discount: 0, paymentMethod: 'card', branchId: 'b1', activatedAt: fmt(addDays(today, -20)), autoActivateDate: null },
  { id: 's2', clientId: 'c2', planId: 'p2', planName: '8 занятий', purchaseDate: fmt(addDays(today, -15)), endDate: fmt(addDays(today, 30)), sessionsLeft: 5, freezeDaysLeft: 5, frozenFrom: null, frozenTo: null, status: 'active', price: 3200, discount: 0, paymentMethod: 'cash', branchId: 'b1', activatedAt: fmt(addDays(today, -15)), autoActivateDate: null },
  { id: 's3', clientId: 'c5', planId: 'p1', planName: 'Безлимит на месяц', purchaseDate: fmt(addDays(today, -5)), endDate: fmt(addDays(today, 25)), sessionsLeft: 'unlimited', freezeDaysLeft: 7, frozenFrom: null, frozenTo: null, status: 'active', price: 4500, discount: 10, paymentMethod: 'card', branchId: 'b1', activatedAt: fmt(addDays(today, -5)), autoActivateDate: null },
];

const defaultSchedule: ScheduleEntry[] = [
  { id: 'se1', trainingTypeId: 'tt1', trainerId: 't1', branchId: 'b1', date: fmt(today), time: '09:00', maxCapacity: 15, enrolledClientIds: ['c1', 'c5'], hallId: 'h1' },
  { id: 'se2', trainingTypeId: 'tt2', trainerId: 't2', branchId: 'b1', date: fmt(today), time: '11:00', maxCapacity: 20, enrolledClientIds: ['c2'], hallId: 'h2' },
  { id: 'se3', trainingTypeId: 'tt1', trainerId: 't1', branchId: 'b1', date: fmt(addDays(today, 1)), time: '09:00', maxCapacity: 15, enrolledClientIds: [], hallId: 'h1' },
  { id: 'se4', trainingTypeId: 'tt4', trainerId: 't1', branchId: 'b1', date: fmt(addDays(today, 1)), time: '18:00', maxCapacity: 12, enrolledClientIds: ['c1'], hallId: 'h1' },
  { id: 'se5', trainingTypeId: 'tt3', trainerId: 't3', branchId: 'b2', date: fmt(today), time: '10:00', maxCapacity: 25, enrolledClientIds: [] },
  { id: 'se6', trainingTypeId: 'tt2', trainerId: 't2', branchId: 'b1', date: fmt(addDays(today, 2)), time: '10:00', maxCapacity: 20, enrolledClientIds: [], hallId: 'h2' },
  { id: 'se7', trainingTypeId: 'tt4', trainerId: 't1', branchId: 'b1', date: fmt(addDays(today, 3)), time: '09:30', maxCapacity: 12, enrolledClientIds: [], hallId: 'h1' },
];

const defaultVisits: Visit[] = [
  { id: 'v1', clientId: 'c1', scheduleEntryId: 'se1', date: fmt(addDays(today, -7)), status: 'attended', subscriptionId: 's1', isSingleVisit: false, price: 0 },
  { id: 'v2', clientId: 'c2', scheduleEntryId: 'se2', date: fmt(addDays(today, -5)), status: 'attended', subscriptionId: 's2', isSingleVisit: false, price: 0 },
  { id: 'v3', clientId: 'c3', scheduleEntryId: 'se1', date: fmt(addDays(today, -3)), status: 'attended', subscriptionId: null, isSingleVisit: true, price: 700 },
];

const defaultSales: Sale[] = [
  { id: 'sl1', clientId: 'c1', type: 'subscription', itemId: 'p1', itemName: 'Безлимит на месяц', price: 4500, discount: 0, finalPrice: 4500, paymentMethod: 'card', date: fmt(addDays(today, -20)), branchId: 'b1', isFirstSubscription: false, isReturn: false, isRenewal: true },
  { id: 'sl2', clientId: 'c2', type: 'subscription', itemId: 'p2', itemName: '8 занятий', price: 3200, discount: 0, finalPrice: 3200, paymentMethod: 'cash', date: fmt(addDays(today, -15)), branchId: 'b1', isFirstSubscription: true, isReturn: false, isRenewal: false },
  { id: 'sl3', clientId: 'c3', type: 'single', itemId: 'sv1', itemName: 'Разовое посещение (Йога)', price: 700, discount: 0, finalPrice: 700, paymentMethod: 'cash', date: fmt(addDays(today, -3)), branchId: 'b1', isFirstSubscription: false, isReturn: false, isRenewal: false },
  { id: 'sl4', clientId: 'c5', type: 'subscription', itemId: 'p1', itemName: 'Безлимит на месяц', price: 4500, discount: 10, finalPrice: 4050, paymentMethod: 'card', date: fmt(addDays(today, -5)), branchId: 'b1', isFirstSubscription: false, isReturn: false, isRenewal: true },
];

const defaultInquiries: Inquiry[] = [
  { id: 'inq1', branchId: 'b1', date: fmt(addDays(today, -2)), channel: 'Instagram', adSource: 'Таргет', note: '' },
  { id: 'inq2', branchId: 'b1', date: fmt(addDays(today, -1)), channel: 'WhatsApp', adSource: 'Сарафанное радио', note: '' },
  { id: 'inq3', branchId: 'b1', date: fmt(today), channel: 'Телефон', adSource: 'Вывеска', note: '' },
];

const defaultExpenseCategories: ExpenseCategory[] = [
  { id: 'ec1', name: 'Аренда', branchId: 'b1' },
  { id: 'ec2', name: 'Зарплата тренеров', branchId: 'b1' },
  { id: 'ec3', name: 'Инвентарь', branchId: 'b1' },
  { id: 'ec4', name: 'Коммунальные', branchId: 'b1' },
  { id: 'ec5', name: 'Реклама', branchId: 'b1' },
];

const defaultExpenses: Expense[] = [
  { id: 'exp1', branchId: 'b1', categoryId: 'ec1', amount: 50000, date: fmt(addDays(today, -15)), comment: 'Аренда за март', paymentMethod: 'card' },
  { id: 'exp2', branchId: 'b1', categoryId: 'ec2', amount: 30000, date: fmt(addDays(today, -10)), comment: 'Зарплата Ивановой', paymentMethod: 'cash' },
];

export interface NotificationCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  enabled: boolean;
  // Настройки условий
  daysAhead?: number;  // за сколько дней предупреждать (для "заканчивается абонемент")
  daysAgo?: number;    // сколько дней назад (для "2 недели назад")
}

export const DEFAULT_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { id: 'nc1', key: 'birthday', label: 'Дни рождения', icon: 'Cake', color: 'text-pink-500', enabled: true },
  { id: 'nc2', key: 'sub_end', label: 'Абонемент заканчивается', icon: 'CalendarX', color: 'text-orange-500', enabled: true, daysAhead: 3 },
  { id: 'nc3', key: 'last_session', label: 'Последняя тренировка', icon: 'AlertCircle', color: 'text-amber-500', enabled: true },
  { id: 'nc4', key: 'two_weeks', label: 'Куплено N дней назад', icon: 'ShoppingBag', color: 'text-blue-500', enabled: true, daysAgo: 14 },
  { id: 'nc5', key: 'first_today', label: 'Первая тренировка сегодня', icon: 'Star', color: 'text-violet-500', enabled: true },
  { id: 'nc6', key: 'first_tomorrow', label: 'Первая тренировка завтра', icon: 'Bell', color: 'text-indigo-500', enabled: true },
  { id: 'nc7', key: 'missed_first', label: 'Не пришёл на первую', icon: 'UserX', color: 'text-red-500', enabled: true },
  { id: 'nc8', key: 'no_sub_after_first', label: 'После первой — нет абонемента', icon: 'CreditCard', color: 'text-emerald-600', enabled: true },
  { id: 'nc9', key: 'newcomer_rescheduled', label: 'Новичок перезаписался', icon: 'RefreshCw', color: 'text-teal-500', enabled: true },
];

export interface AppState {
  branches: Branch[];
  halls: Hall[];
  trainers: Trainer[];
  trainingCategories: TrainingCategory[];
  trainingTypes: TrainingType[];
  subscriptionPlans: SubscriptionPlan[];
  singleVisitPlans: SingleVisitPlan[];
  clients: Client[];
  subscriptions: Subscription[];
  schedule: ScheduleEntry[];
  visits: Visit[];
  sales: Sale[];
  inquiries: Inquiry[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  salesPlans: SalesPlan[];
  monthlyPlans: MonthlyPlan[];
  expensePlans: ExpensePlan[];
  staff: StaffMember[];
  currentStaffId: string;
  contactChannels: string[];
  adSources: string[];
  currentBranchId: string;
  dismissedNotifications: string[]; // ключи вида `${categoryKey}:${clientId}:${date}`
  failedNotifications: Record<string, string>; // key -> причина
  notificationCategories: NotificationCategory[];
  importedCvetnoiV1?: boolean;
  importedCvetnoiV2?: boolean;
  importedCvetnoiV3?: boolean;
}

const defaultStaff: StaffMember[] = [
  {
    id: 'st1', name: 'Иванов Алексей Петрович', role: 'director', phone: '+7 (999) 100-00-01',
    email: 'director@fitcrm.ru', branchIds: ['b1', 'b2'],
    permissions: { ...DEFAULT_PERMISSIONS.director }, createdAt: fmt(addDays(today, -365)),
    login: 'director', password: '1234',
  },
  {
    id: 'st2', name: 'Петрова Светлана Николаевна', role: 'manager', phone: '+7 (999) 100-00-02',
    email: 'manager@fitcrm.ru', branchIds: ['b1'],
    permissions: { ...DEFAULT_PERMISSIONS.manager }, createdAt: fmt(addDays(today, -200)),
    login: 'manager', password: '1234',
  },
  {
    id: 'st3', name: 'Козлова Анна Викторовна', role: 'admin', phone: '+7 (999) 100-00-03',
    email: 'admin@fitcrm.ru', branchIds: ['b1'],
    permissions: { ...DEFAULT_PERMISSIONS.admin }, createdAt: fmt(addDays(today, -100)),
    login: 'admin', password: '1234',
  },
];

const initialState: AppState = {
  branches: defaultBranches,
  halls: defaultHalls,
  trainers: defaultTrainers,
  trainingCategories: defaultTrainingCategories,
  trainingTypes: defaultTrainingTypes,
  subscriptionPlans: defaultPlans,
  singleVisitPlans: defaultSingleVisitPlans,
  clients: defaultClients,
  subscriptions: defaultSubscriptions,
  schedule: defaultSchedule,
  visits: defaultVisits,
  sales: defaultSales,
  inquiries: defaultInquiries,
  expenseCategories: defaultExpenseCategories,
  expenses: defaultExpenses,
  salesPlans: [],
  monthlyPlans: [],
  expensePlans: [],
  staff: defaultStaff,
  currentStaffId: 'st1',
  contactChannels: ['Instagram', 'WhatsApp', 'Telegram', 'Телефон', 'VK', 'Лично'],
  adSources: ['Таргет Instagram', 'Таргет VK', 'Сарафанное радио', 'Вывеска', 'Google', 'Яндекс', 'Блогер'],
  currentBranchId: 'b1',
  dismissedNotifications: [],
  failedNotifications: {},
  notificationCategories: DEFAULT_NOTIFICATION_CATEGORIES,
};

const STORAGE_KEY = 'fitcrm_state_v1';
const AUTH_KEY = 'fitcrm_auth_v1';

function mapAdSource(cat: string): string {
  const c = (cat || '').toLowerCase();
  if (c.includes('вк') || c.includes('vk')) return 'Таргет VK';
  if (c.includes('инст') || c.includes('inst')) return 'Таргет Instagram';
  if (c.includes('рекомендации') || c.includes('сарафан') || c.includes('вацап') || c.includes('whatsapp') || c.includes('база партнеров')) return 'Сарафанное радио';
  if (c.includes('проходящий') || c.includes('наружная')) return 'Вывеска';
  if (c.includes('авито')) return 'Авито';
  if (c.includes('карты') || c.includes('заявка mail') || c.includes('входящий звонок')) return 'Google';
  if (c.includes('промокод') || c.includes('блогер')) return 'Блогер';
  if (c.includes('виджет') || c.includes('самостоятельная')) return 'Яндекс';
  if (c.includes('рассылка')) return 'Таргет VK';
  return '';
}

function parseImportedStatus(lastVisit: string): ClientCategory {
  if (!lastVisit) return 'new';
  const d = new Date(lastVisit);
  if (isNaN(d.getTime())) return 'new';
  const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 30) return 'loyal';
  if (daysSince <= 90) return 'sleeping';
  return 'lost';
}

function parseName(col1: string, col2: string): { firstName: string; lastName: string; middleName: string } {
  const clean1 = col1.trim().replace(/^"+|"+$/g, '');
  const clean2 = (col2 || '').trim().replace(/^"+|"+$/g, '');
  const skip = ['ФМ', 'Фитмост', 'Клиент', 'ФМ', 'кли ент'];
  if (clean1.includes(' ') && (!clean2 || skip.includes(clean2))) {
    const parts = clean1.split(/\s+/);
    const lastName = parts[0];
    const firstName = parts[1] || '';
    const middleName = parts.slice(2).join(' ');
    return { firstName, lastName, middleName };
  }
  if (clean2 && !skip.includes(clean2) && !clean2.includes('абонемент') && !clean2.includes('мес') && !clean2.includes('тр')) {
    if (clean1.includes(' ')) {
      const parts = clean1.split(/\s+/);
      const isFirstNameFirst = /^[А-ЯЁ][а-яё]+$/.test(parts[0]) && parts.length <= 2;
      if (isFirstNameFirst && parts.length === 1) {
        return { firstName: parts[0], lastName: clean2, middleName: '' };
      }
    }
    return { firstName: clean1, lastName: clean2, middleName: '' };
  }
  if (clean1.includes(' ')) {
    const parts = clean1.split(/\s+/);
    return { firstName: parts[1] || '', lastName: parts[0], middleName: parts.slice(2).join(' ') };
  }
  return { firstName: clean1, lastName: '', middleName: '' };
}

type RawClient = [string, string, string, string, number, string, string, string];

const CVETNOI_RAW: RawClient[] = [
  ['Смирнова','Олеся','79807069520','',47200,'групповые, набор мышечной массы','2026-03-27','вк'],
  ['Алфутова Ксения','','79601377002','',5200,'','2026-03-27','вацап'],
  ['Шубина Ирина','','79515468662','',2400,'','2026-03-27',''],
  ['Анастасия','Сметанина','79225115800','',6099,'','2026-03-27',''],
  ['Вероника Бегишева','','79202362880','',21235,'','2026-03-27',''],
  ['Анастасия','Будкова','79524963408','',7499,'','2026-03-27',''],
  ['Наталья','Измайлова','79805490427','',2699,'','2026-03-27',''],
  ['Ускова Наталья','','79081425162','',5899,'Есть все соц сети','2026-03-27',''],
  ['Почукаева Ксения Ивановна','','79192373315','',12300,'2 аб по 8 тр','2026-03-27',''],
  ['Семенцова Татьяна','','79805378634','1991-04-26',9280,'','2026-03-27',''],
  ['Купцова Ксения','','79507596760','',29400,'+10 дн заморозки','2026-03-26','вк'],
  ['Шумакова Наталья','','79155583929','',14200,'','2026-03-26','самостоятельная запись через виджет'],
  ['Шихмагомедова Элина','','79507300062','',5800,'','2026-03-26','Приветственное инст'],
  ['Ворданян Анаит','','79031462063','',28299,'','2026-03-26',''],
  ['Рыбинская Виктория','','79009541745','',49800,'6 мес 7.07.24','2026-03-26','приветственное вк'],
  ['Людмила','Хохлова','79204129626','',11700,'Max, Телеграм','2026-03-26','проходящий трафик'],
  ['Юлия','Осташко','79997227576','',5800,'','2026-03-26',''],
  ['Амелина Екатерина','','79092118452','',40700,'','2026-03-25','проходящий трафик'],
  ['Анастасия Киселёва','','79669998062','',7600,'','2026-03-25',''],
  ['Русанова Людмила','','79515531169','',8610,'','2026-03-25','вк'],
  ['Быкова Галина','','79518507016','',28090,'1500 кэшбек','2026-03-25','рекомендации клиента'],
  ['Степанова Марина Александровна','','79518792208','',54560,'','2026-03-25','вк'],
  ['Авдонина Наталия','','79102839076','',61280,'рассрочка','2026-03-25','приветственное вк'],
  ['Бобкова Наталья','','79009500463','',46454,'','2026-03-25','вк реклама'],
  ['Екатерина','Киселева','79515619267','',4199,'есть все соц сети','2026-03-25',''],
  ['Палочкина Ольга','','79204111266','',53196,'','2026-03-24','проходящий трафик'],
  ['Храмова Эльвина','','79518733967','',31580,'','2026-03-24',''],
  ['Евгения','Попова','79601140945','',2899,'','2026-03-24',''],
  ['Цыбуляева Евгения','','79056828663','',28550,'','2026-03-23',''],
  ['Полозова Линда','','79515566066','',44300,'','2026-03-23','рекомендации клиента'],
  ['Калашникова Светлана','','79507667266','',37300,'','2026-03-21',''],
  ['Фролова Ирина','','79081463027','',25205,'','2026-03-21','вацап'],
  ['Наталья','Чиркова','79204131636','1995-11-08',14480,'','2026-03-20','карты'],
  ['Анастасия','Голубцова','79081430504','',22510,'','2026-03-20','проходящий трафик'],
  ['Стародубцева Ирина Ивановна','','79011932973','',40300,'8 тр 27.06.23','2026-03-19','инстаграмм'],
  ['Маргарита','Зацепина','79102804172','',299,'','2026-03-17',''],
  ['Елизарова Анастасия','','79532623951','',400,'3 мес 08.02.24','2026-03-16',''],
  ['Наталия Хрипунова','','79009558073','',3900,'','2026-03-13','вк реклама'],
  ['Яна Попова','','79655627110','',800,'','2026-03-11','авито'],
  ['Рощупкина Юлия','','79042908085','',11600,'','2026-03-06','вк'],
  ['Жидких Мария','','79939452833','',7410,'','2026-03-06','вк'],
  ['Сушкова Тамара','','79042144373','',3900,'','2026-02-25',''],
  ['Рощупкина Екатерина','','79038550236','',16900,'','2026-02-18',''],
  ['Сидорова Ольга','','79518663353','1994-04-11',16660,'','2026-02-18','рекомендации клиента'],
  ['Наталья','','77900950046','',300,'','2026-02-04',''],
  ['Полина','Семенова','79066727643','',10599,'','2026-02-02',''],
  ['Соня','Ткаченко','79204295486','',6699,'яндекс','2026-01-27','промокод АННА'],
  ['Краевская Екатерина','','79192806612','',22399,'','2026-01-23','Приветственное инст'],
  ['Колесникова Наталья','','79507569241','',13799,'','2026-01-23','вк'],
  ['Чеботарева Олеся Сергеевна','','79009524421','',299,'','2026-01-23',''],
  ['Фонова','','79805517486','',15699,'','2026-01-21','вк'],
  ['Татьяна','Бежина','79103414960','',11100,'','2026-01-21','вк'],
  ['Соколова Екатерина','','79525475548','',0,'провести абик за 0р','2026-01-21','вк'],
  ['Кныш Мария','','79081384581','',23355,'','2026-01-21','вк реклама'],
  ['Сторожилова Екатерина','','79204027383','',21715,'','2026-01-16','приветственное вк'],
  ['Екатерина','Самаричева','79009508616','',400,'','2026-01-16',''],
  ['Диана','Асатрян','79081312211','',3900,'','2026-01-16','вк'],
  ['Вишневская Наталья','','79515533578','',29000,'','2026-01-12','Приветственное инст'],
  ['Черткова Алена','','79623284244','',33855,'','2026-01-12','вк'],
  ['Кондаурова Оксана','','79102428404','1981-12-26',19100,'','2026-01-09','карты'],
  ['Светлана','Зубкова','79009455833','',11100,'','2026-01-09',''],
  ['Анна Гаврилова','','79192523664','',3900,'','2026-01-06',''],
  ['Острикова Виктория','','79081433564','1987-11-20',12070,'','2025-12-26','приветственное вк'],
  ['Томашкевич Мария Александровна','','79103223354','',8199,'','2025-12-25','вк'],
  ['Анна','Федоренко','79515588270','',14200,'','2025-12-25','вк'],
  ['Винникова Вероника','','79518628893','',17100,'15 лет','2025-12-25',''],
  ['Белова Наталья','','79964513713','1985-06-07',6000,'Администратор 45','2025-12-22','авито'],
  ['Марина','Марченко','79507738778','',5800,'','2025-12-21',''],
  ['Мунтян Екатерина','','79507579296','',20600,'','2025-12-16','промокод АННА'],
  ['Мила','Шабунина','79103422452','',11500,'','2025-12-15',''],
  ['Эвелина','','79529576516','',7274,'','2025-12-15',''],
  ['Светлана','Гавриченко','79525538194','',5400,'','2025-12-14','проходящий трафик'],
  ['Алиса','Андрюкова','79902000136','',9450,'','2025-12-14',''],
  ['Андрюкова Евгения','','79204170601','',9750,'','2025-12-14',''],
  ['Лейченко Анастасия','','79805375329','2000-03-02',2699,'','2025-12-14','Приветственное инст'],
  ['Грибачева Юлия','','79805334006','',15400,'','2025-12-14','вацап'],
  ['Екатерина','Буга','79009896302','',11800,'','2025-12-13','инстаграмм'],
  ['Мерзликина Ольга','','79003001997','',11100,'','2025-12-12',''],
  ['Алена','Самсонова','79518659079','',36500,'','2025-12-10','рекомендации клиента'],
  ['Табакурова Татьяна','','79063032267','',31700,'','2025-12-09','вк'],
  ['Ирина','Пупкова','79515559941','',299,'','2025-12-09',''],
  ['Анна','Бабина','79191871004','',32400,'','2025-12-09','вацап'],
  ['Хвостова Светлана','','79805387988','',46800,'','2025-12-09',''],
  ['Шанина София','','79208061915','',11100,'','2025-12-08',''],
  ['Швецова Светлана','','79204554011','',21200,'3 аб 3 мес','2025-12-08','проходящий трафик'],
  ['Попова Юлия','','79003030289','',0,'','2025-12-07',''],
  ['Каменева Карина','','79102806650','',19980,'','2025-12-06','проходящий трафик'],
  ['Силименива Наталья','','79192357622','',12300,'','2025-12-06','рекомендации клиента'],
  ['Лесных Ирина','','79003054547','',31990,'','2025-12-06','вк'],
  ['Белозерцева Мария Викторовна','','79009541696','',20560,'','2025-12-04','вк реклама'],
  ['Котова Татьяна','','79092173569','',25100,'','2025-12-03','вк'],
  ['Крюкова Маргарита','','79102851720','',43500,'скидка 10% на след аб','2025-12-03','проходящий трафик'],
  ['Золоторева Анастасия','','79056580471','',12300,'8 тр 06.12.23','2025-12-02',''],
  ['Бакалова Ольга','','79515518867','',17850,'','2025-12-01',''],
  ['Китаева Елена','','79204076728','',24989,'','2025-12-01',''],
  ['Рябых Дина','','79204005208','',10700,'3 мес б 19.03.24','2025-11-29','Приветственное инст'],
  ['Любчик Анжелика','','79601302236','2008-05-25',6599,'','2025-11-28',''],
  ['Александра','Махнина','79991843873','',15309,'','2025-11-27','вк'],
  ['Амелина Арина','','79601341240','',22500,'','2025-11-26','рекомендации клиента'],
  ['Алёна','','79056898048','',299,'','2025-11-25',''],
  ['Надежда','Кондратьева','79525525281','',3900,'','2025-11-25','вк реклама'],
  ['Ляшенко Татьяна','','79518672701','',27365,'','2025-11-24','проходящий трафик'],
  ['Кондратьева Ольга','','79805426978','',18900,'','2025-11-24','рекомендации клиента'],
  ['Мария','Коняева','79192353659','',598,'','2025-11-24',''],
  ['Жданова Арина','','79247897551','',15300,'','2025-11-23',''],
  ['Жданова Кристина','','79247894925','',15600,'','2025-11-23',''],
  ['Виктория','Петухова','79009440562','',4574,'','2025-11-23',''],
  ['Виктория','Подгорнова','79009333952','',19000,'','2025-11-21','карты'],
  ['Сотникова','','79518583215','1973-09-04',4199,'','2025-11-20','проходящий трафик'],
  ['Тульская Евгения','','79518713883','',0,'','2025-11-20',''],
  ['Елена','Беляева','79521046740','',15600,'','2025-11-19',''],
  ['Наталья Акименко','','79204186544','1982-03-15',4199,'','2025-11-19',''],
  ['Ахадова Лейла','','79964126882','',16000,'','2025-11-17',''],
  ['Линова Татьяна','','79081314393','1985-06-24',22710,'','2025-11-17',''],
  ['Радина Юлия','','79611898401','',12400,'','2025-11-15','авито'],
  ['Измайлова Светлана','','79204179580','',3500,'','2025-11-14','вк'],
  ['Жердева Елизавета','','79855528805','',299,'','2025-11-12',''],
  ['Татьяна','Попова','79803441447','',299,'','2025-11-12','проходящий трафик'],
  ['Анна','','79805458952','',299,'','2025-11-11',''],
  ['Анастасия Дронова','','79009304975','',400,'','2025-11-11',''],
  ['Козорезова Евгения','','79081452726','2001-10-19',11100,'','2025-11-11','проходящий трафик'],
  ['Коденцева Наталья','','79521045851','2000-02-19',21405,'','2025-11-05','проходящий трафик'],
  ['Юлия','Зубова','79525498867','',6099,'','2025-11-04','рекомендации клиента'],
  ['Тронева Ирина','','79518743394','',24900,'','2025-11-04',''],
  ['Головко Ольга','','79050534292','',21960,'','2025-11-03','рекомендации клиента'],
  ['Головко Олеся','','79601205640','',19115,'','2025-11-03','проходящий трафик'],
  ['Лиханская Елена','','79192491674','',15500,'','2025-11-03','рекомендации клиента'],
  ['Илюхина Мария','','79009269321','',2699,'','2025-11-03','Приветственное инст'],
  ['Ртищева Людмила','','79202276863','',19500,'','2025-11-03','вк'],
  ['Ященко Анастасия','','79521030937','',4200,'','2025-11-02','вк'],
  ['Арпине','Даллакян','79204476156','',4199,'','2025-10-31',''],
  ['Варвянская Елена','','79050504998','',12070,'','2025-10-31',''],
  ['Юлия','Никитюк','79192467855','2001-07-23',2899,'','2025-10-31','база партнеров'],
  ['Мария','Скворцова','79518561895','2008-07-01',4199,'','2025-10-29','самостоятельная запись через виджет'],
  ['Диана Андреевна','Самара','79205966114','',11199,'','2025-10-28','наружная реклама'],
  ['Сабрина','Зиедуллоева','79159561203','1999-10-11',1799,'','2025-10-22','проходящий трафик'],
  ['Усольцева Дарья','','79534717221','2000-03-01',299,'','2025-10-22','проходящий трафик'],
  ['Елена','Игринева','79042105272','',7154,'','2025-10-21','проходящий трафик'],
  ['Черемушкина Юлия','','79515679443','',9900,'','2025-10-20',''],
  ['Марьяна','Сыромятникова','79601009378','',10354,'переоформлен аб','2025-10-19','рекомендации клиента'],
  ['Рогова Виктория','','79952501943','',10700,'','2025-10-14',''],
  ['Димитренко Екатерина','','79103250477','',15900,'3 аб 3 мес','2025-10-14','инстаграмм'],
  ['Анна','Романова','79507643747','',299,'','2025-10-11',''],
  ['Рындина Алина','','79192345697','',6100,'','2025-10-08',''],
  ['Валерия','Черных','79045373651','',299,'','2025-10-07','карты'],
  ['Татьяна','Морева','79518640127','',7900,'','2025-10-07',''],
  ['Мухина Екатерина','','79507620558','2002-09-02',4800,'','2025-10-06',''],
  ['Самсонова Мария','','79802456884','1998-08-05',15800,'','2025-10-04',''],
  ['Лосихина Светлана','','79107446853','1991-10-06',299,'','2025-10-04','вк'],
  ['Виктория','Привалова','79009604153','2002-01-03',5800,'','2025-10-01','рекомендации клиента'],
  ['Марина','Гришенко','79507671757','',15299,'','2025-09-30','карты'],
  ['Фролова Алина','','79803414701','',14360,'подарочный сертификат','2025-09-26','вацап'],
  ['Коржова Ангелина','','79204504625','',14900,'','2025-09-24','вк реклама'],
  ['Фролова Ольга','','79518690814','',14760,'1 посещение по сертификату','2025-09-22','вацап'],
  ['Воронина Инна','','79803435550','',12900,'','2025-09-18','Приветственное инст'],
  ['Алина','Рындина','79192345691','',4200,'','2025-09-18','вк'],
  ['Катерина Егорцова','','79525554225','',1500,'','2025-09-18','вк'],
  ['Виктория','Терихова','79610291663','1998-03-17',5800,'','2025-09-17','проходящий трафик'],
  ['Мария','Савицкая','79515561149','',8700,'','2025-09-17',''],
  ['Ашихмена Иветта','','79800929771','',11100,'','2025-09-17','рассылка ВК'],
  ['Синько Диана','','79102550869','',3900,'','2025-09-16',''],
  ['Серикова Лилия','','79019937999','',15200,'5 аб по 8 тр','2025-09-11','вк'],
  ['Юлия Ильинская','','79518688276','',13900,'','2025-09-11','рекомендации клиента'],
  ['Зимникова Людмила','','79081335317','1979-06-22',14315,'','2025-09-11','проходящий трафик'],
  ['Светлана Колпакова','','79507796811','',4200,'','2025-09-10','наружная реклама'],
  ['Лебедева Екатерина','','79204437516','',12120,'','2025-09-03','вацап'],
  ['Цай Анастасия','','79290082663','',5900,'','2025-09-02',''],
  ['Есения','Воронько','79610283793','1995-05-14',400,'','2025-08-29','рассылка ВК'],
  ['Хижкина Марина','','79950378454','2002-10-31',4200,'','2025-08-26',''],
  ['Столярова Екатерина','','79525420789','',12200,'','2025-08-26',''],
  ['Воронько Есения','','79009507324','1995-05-14',4199,'','2025-08-26','вк реклама'],
  ['Фролова Наталия','','79805467696','',12854,'','2025-08-25','заявка mail'],
  ['Баутина Екатерина','','79066746572','2000-06-20',4200,'','2025-08-25','инстаграмм'],
  ['Фурсова Юлия','','79290095552','',3900,'8 трень 10.11.23','2025-08-24','вк'],
  ['Микитенко Екатерина','','79803492994','',9200,'3 аб по 8 тр','2025-08-21',''],
  ['Анастасия','Шухарева','79964524595','',11705,'','2025-08-21',''],
  ['Мария','Туманова','79204464594','',8200,'','2025-08-20','самостоятельная запись через виджет'],
  ['Билявич Марина','','79081442378','',21900,'','2025-08-20','вк реклама'],
  ['Карпенко Екатерина Алексеевна','','79524387372','',13860,'','2025-08-19',''],
  ['Евдакова Евгения','','79601254128','',11644,'','2025-08-18','проходящий трафик'],
  ['Карташева Юлия','','79525514431','',15840,'8 тр 10.11.23','2025-08-14','рассылка инст'],
  ['Елена','Попова','79950363479','',4200,'','2025-08-13','вацап'],
  ['Жегульская Екатерина','','79081460222','',4200,'','2025-08-12',''],
  ['Валерия','Кузнецова','79521066359','',8400,'','2025-08-12',''],
  ['Липатова Юлия','','79610349828','',9900,'','2025-08-12','вк реклама'],
  ['Елфимова Анастасия','','79601038630','',9700,'','2025-08-10','вацап'],
  ['Анна','Прохорова','79202291128','',0,'','2025-08-09',''],
  ['Елизавета','Простакишина','79956207498','',8400,'','2025-08-07','приветственное вк'],
  ['Муратова Валерия','','79606336690','',6300,'','2025-08-07',''],
  ['Екатерина Новикова','','79290593852','',4200,'','2025-08-06','вк'],
  ['Акулова Ирина','','79100415700','',17300,'+2 дня заморозок','2025-08-05','приветственное вк'],
  ['Екатерина','Мальцева','79507532899','',1500,'','2025-08-04',''],
  ['Санникова Любовь','','79805413324','1992-02-15',10200,'','2025-08-01','проходящий трафик'],
  ['Полетаева Татьяна','','79507604359','',11100,'','2025-07-31',''],
  ['Галушкина Надежда Александровна','','79805420571','',7600,'','2025-07-31','Приветственное инст'],
  ['Грецова Александра','','79065818171','',11130,'доплата 900р','2025-07-29','проходящий трафик'],
  ['Баранова Яна Сергеевна','','79106546057','',299,'','2025-07-29','самостоятельная запись через виджет'],
  ['Маликова Дарья','','79803438311','1981-01-11',4200,'','2025-07-28',''],
  ['Верзилина Светлана','','79081357871','',4200,'','2025-07-28',''],
  ['Анохина Татьяна','','79102836012','',15900,'','2025-07-24','приветственное вк'],
  ['Наталия','Топтунова','79525461117','',4200,'','2025-07-24','заявка mail'],
  ['Волкова Анастасия','','79010930883','',9700,'','2025-07-23','приветственное вк'],
  ['Коренюгина Кристина','','79192321369','',13900,'','2025-07-22','заявка mail'],
  ['Нахабенко Ольга','','79036507098','',9500,'','2025-07-21','вк'],
  ['Алена','Чеботарева','79204197421','',4499,'Шейный остеохондроз','2025-07-21','заявка mail'],
  ['Городская Лариса','','79205694715','',6000,'','2025-07-18','рекомендации клиента'],
  ['Екатерина','Анискина','79205129123','',9700,'','2025-07-18','рекомендации клиента'],
  ['Митина Елизавета','','79529516530','',17800,'','2025-07-14','рекомендации клиента'],
  ['Авилова Алёна','','79202222996','',299,'','2025-07-14','вк реклама'],
  ['Ленченко Арина','','79204420825','',12100,'','2025-07-14','проходящий трафик'],
  ['Фролова Екатерина','','79056584212','1983-05-20',0,'','2025-07-11','вк реклама'],
  ['Гладышева Лиана','','79204533453','',15200,'1 мес 2 шт, 3 месяца 25.06.24','2025-07-10','рассылка ВК'],
  ['Галушкина Карина','','79087860056','',5900,'','2025-07-09','вацап'],
  ['Маргарита','Дудина','79601336263','',0,'','2025-07-07',''],
  ['Таласова Александра','','79081423599','',7000,'','2025-07-07','вк'],
  ['Ковалева Анна','','79192436543','',11800,'','2025-07-06','вацап'],
  ['Короткова Яна','','79920512955','',299,'','2025-07-06','карты'],
  ['Бортникова Арина','','79204623618','',6000,'','2025-07-04','вк реклама'],
  ['Ольга Болохонова','','79056444013','',299,'','2025-07-04','вк реклама'],
  ['Ирина','Кривовая','79081420307','',299,'','2025-07-02','вк реклама'],
  ['Жерибор Анна','','79081401490','',6000,'1 мес б 17.10.23','2025-07-01','проходящий трафик'],
  ['Клокова Алена','','79056885754','1996-04-05',7000,'','2025-07-01','приветственное вк'],
  ['Сарибекян Надежда','','79003084892','1998-01-24',12900,'','2025-07-01','вк'],
  ['Якименко Ольга','','79003027753','',9800,'','2025-06-30','вк'],
  ['Елена Чаркина','','79081388618','',4000,'','2025-06-30',''],
  ['Юлия','Юрьева','79155711680','',4500,'','2025-06-30','вк'],
  ['Сухинина Виктория','','79529520496','',7000,'','2025-06-30','рекомендации клиента'],
  ['Меньшикова Ирина','','79212928564','',8000,'','2025-06-30','вк'],
  ['Парамонова Наталья','','79102410715','',10700,'','2025-06-30','вк'],
  ['Шеремет Оксана','','79507709732','',299,'','2025-06-28','заявка mail'],
  ['Виктория','Гуцалюк','79304029993','',299,'','2025-06-27','заявка mail'],
  ['Попова Вероника','','79042142824','',5200,'','2025-06-25','вк'],
  ['Алина','Рахманалиева','79525572408','',3800,'','2025-06-25',''],
  ['Лобанова Наталья','','79521012389','',6760,'','2025-06-24','карты'],
  ['Белозерова Ирина','','79204444364','',6000,'','2025-06-23','вк реклама'],
  ['Татьяна','Белоножкина','79009320752','',24100,'','2025-06-16','вк'],
  ['Ударцева Юлия','','79515579035','',7600,'','2025-06-15','вацап'],
  ['Зеленина Юлия','','79204602218','',26700,'','2025-06-15','рассылка ВК'],
  ['Астапова Анна','','79802417857','',5100,'','2025-06-12',''],
  ['Дарья','Боброва','79525424720','',3800,'','2025-06-12','входящий звонок'],
  ['Юлия','Чурилова','79038559505','',5800,'','2025-06-10','вк'],
  ['Анна','Шестопалова','79058900377','',1500,'','2025-06-10','заявка mail'],
  ['Евгения','Зяблова','79525571576','',299,'','2025-06-10','рекомендации клиента'],
  ['Смирных Олеся Николаевна','','79525540828','',4100,'','2025-06-10','самостоятельная запись через виджет'],
  ['Виктория','Репринцева','79805578185','',3800,'1 мес 25.12.23','2025-06-06','вк'],
  ['Куренева Алина','','79507748826','',6000,'','2025-06-06','вк'],
  ['Забудько Екатерина','','79525408698','',200,'','2025-06-06','заявка mail'],
  ['Ирина','Ковылова','79092115087','',299,'','2025-06-05',''],
  ['Махматкулова Алла','','79155819375','',7000,'','2025-06-05','Приветственное инст'],
  ['Мухина Юлия','','79155467997','',13500,'','2025-06-02','самостоятельная запись через виджет'],
  ['Богомолова Татевик','','79009569303','',6000,'','2025-05-30','вк'],
  ['Анастасия','Попова','79511323337','',4800,'','2025-05-29','проходящий трафик'],
  ['Браташ Ольга','','79205995903','',3800,'','2025-05-29','приветственное вк'],
  ['Богачева Галина','','79066708499','1983-10-21',8416,'','2025-05-29','рекомендации клиента'],
  ['Болдырева Марина','','79525406801','',5200,'8 тр 26.12.22','2025-05-29','рассылка ВК'],
  ['Медведева Наталья','','79515407112','',9860,'','2025-05-27','заявка mail'],
  ['Счастная Ольга','','79204668487','',4800,'','2025-05-27',''],
  ['Светлана','Свиридова','79525478313','',2400,'','2025-05-27','приветственное вк'],
  ['Вахтина Евгения','','79772876167','',16660,'','2025-05-26','авито'],
  ['Шихмагомедова Гая','','79204073685','',6000,'противопоказания: диастаз','2025-05-26','проходящий трафик'],
  ['Айвазян Асмик','','79144419641','',7900,'','2025-05-22','проходящий трафик'],
  ['Соколова Елена Николаевна','','79081324971','',7900,'','2025-05-21','вацап'],
  ['Валиуллина Ксения','','79525559695','',6460,'','2025-05-21','входящий звонок'],
  ['Осипова Ирина','','79515647846','',6800,'','2025-05-19',''],
  ['Беляева Наталья','','79081478716','',8400,'','2025-05-19',''],
  ['Каклюшина Анастасия','','79103490859','',14400,'','2025-05-18','рассылка ВК'],
  ['Литневская Светлана','','79009267450','',14100,'','2025-05-18','вацап'],
  ['Габриелян Айкуи','','79507786017','',3230,'','2025-05-18','вк'],
  ['Миранович Юлия','','79202281399','',3800,'','2025-05-17','авито'],
  ['Гончарик Ольга','','79066713885','',4100,'','2025-05-16','входящий звонок'],
  ['Тарковская Екатерина','','79518764335','',21068,'','2025-05-14','рассылка ВК'],
  ['Ишутина Анна','','79202471366','',17000,'','2025-05-13','вк реклама'],
  ['Ергина Анастасия','','79537104641','',7900,'','2025-05-12','проходящий трафик'],
  ['Воробьева Екатерина','','79050510084','',29374,'ПОМЕНЯЛА НА 12 ПЕРС ТРЕНИРОВОК','2025-05-08','входящий звонок'],
  ['Марина Корецкая','','79507552759','1982-10-17',4420,'','2025-05-08','заявка mail'],
  ['Надежда','Коновалова','79586493885','',200,'','2025-05-08','рекомендации клиента'],
  ['Фёдорова Виктория','','79204089555','',5900,'','2025-05-07','вк'],
  ['Дарья','Петроченко','79202307162','',0,'','2025-05-07','самостоятельная запись через виджет'],
  ['Кишко Снежана','','79997221393','2001-02-03',6700,'','2025-05-06','вк'],
  ['Ярцева Мария','','79009624710','',9900,'','2025-05-06','проходящий трафик'],
  ['Вирютина Вера','','79204068087','',7900,'','2025-05-06','входящий звонок'],
  ['Ларина Виктория','','79081274466','',7900,'','2025-05-06','инстаграмм'],
  ['Ортикова Нигора','','79805217681','',5900,'','2025-05-06','проходящий трафик'],
  ['Невежина Анастасия','','79009317041','',9900,'','2025-05-06','рекомендации клиента'],
  ['Палихова Татьяна','','79515636469','',8410,'','2025-05-06','инстаграмм'],
  ['Попова Екатерина Александровна','','79205727987','',5900,'','2025-05-06','рекомендации клиента'],
  ['Пивнева Дана','','79805348049','',4800,'','2025-05-06','проходящий трафик'],
  ['Елисеева Диана','','79515623178','',6460,'','2025-05-06','проходящий трафик'],
  ['Маликова Ульяна Евгеньевна','','79102788392','',3800,'','2025-05-06','вк'],
  ['Алексеева Анастасия','','79102494304','',4800,'','2025-05-06','Приветственное инст'],
  ['Алферова Татьяна Владимировна','','79515672730','',8000,'','2025-05-06','приветственное вк'],
  ['Добросоцких Татьяна','','79515420817','',7900,'','2025-05-06','вк'],
  ['Сивкова Дарья','','79805321460','',7900,'','2025-05-06','вк реклама'],
  ['Хлопкова Марина','','79204463144','',7900,'','2025-05-05','вк'],
  ['Саламахина Светлана','','79204543998','',4800,'','2025-05-05','наружная реклама'],
  ['Суворова Дарья','','79205064404','',0,'8 тр 08.05.24','','вк реклама'],
  ['Дьяконова Ксения','','79539642533','',0,'8 тр 13.05.24','','вк реклама'],
  ['Щеглова Алена','','79100405624','',0,'8 тр 28.04.24','','проходящий трафик'],
  ['Зимнухова Екатерина','','79772752130','',0,'3 мес 02.07.24','','рекомендации клиента'],
  ['Еремина Анна','','79155840371','',0,'3 мес безлим 20.06.24','','рекомендации клиента'],
  ['Севостьянова Полина','','79304086802','',0,'3 мес безлим 17.06.24','','рекомендации клиента'],
  ['Болгова Анна','','79204542136','',0,'12 трень 30.05.24','','база партнеров'],
  ['Дрейлинг Вера','','79515679360','',0,'12 трень 14.05.24','','рассылка ВК'],
  ['Лытнева Анна','','79304049297','',0,'2 мес безлим 28.05.24','','рассылка ВК'],
  ['Орловцева Яна','','79192339109','',0,'8 трень 23.03.24','',''],
  ['Перова Юлия','','79009620442','',0,'1 мес. 13.04.24','','рассылка инст'],
  ['Попова Алла','','79038599061','',0,'1 мес 10.04.24','','вк реклама'],
  ['Суязова Ангелина','','79204425282','',0,'8 трень 18.04.24','','рассылка ВК'],
  ['Орлова Екатерина','','79515425378','',0,'3 мес 3.06.24','','рассылка ВК'],
  ['Солопова Татьяна','','79507657320','',0,'3 мес 31.05.24','','рекомендации клиента'],
  ['Никульшина Олеся','','79204599982','',0,'8 трень 31.03.24','','вк реклама'],
  ['Шевелёва Кристина','','79507695396','',0,'3 мес 27.06.24','','проходящий трафик'],
  ['Худякова Валентина','','79066762468','',0,'3 мес 13.06.24','',''],
  ['Попова Алена','','79081396359','',0,'2 по 8 трень 17.05.24','',''],
  ['Гончарова Ольга','','79139110400','',0,'8 трень, 3 мес 25.06.24','',''],
  ['Медведева Ирина','','79192526989','',0,'8 тр 25.03.24','',''],
  ['Русакова Диана','','79203168870','',0,'1 мес, 2 мес 20.05.24','',''],
  ['Перелётова Екатерина','','79066756254','',0,'8 трн 30.04.24','',''],
  ['Кононыхина Дарина','','79304274330','',0,'3 мес 13.05.24','',''],
  ['Фирсова Мария','','79521020145','',0,'3 мес, 2 мес 28.07.24','','Приветственное инст'],
  ['Корчагина Ирина','','79525521523','',0,'3 мес 14.05.24','',''],
  ['Ручкина Виктория','','79081392078','',0,'8 трень 27.03.24','','вацап'],
  ['Соболева Ирина','','79518528389','',0,'8 тр, 2 мес 15.06.24','',''],
  ['Колупаева Розита','','79100405886','',0,'1 мес 6.03.24','',''],
  ['Сморчкова Яна','','79216056375','',0,'1 мес 10.03.24','',''],
  ['Мельничук Галина','','79518737004','',0,'1 мес 10.03.24','','рассылка ВК'],
  ['Капитон Наталья','','79507792662','',0,'8 трень 12.03.24','',''],
  ['Юлдашева Азиза','','79802439309','',0,'1 мес, 3 мес 5.06.24','',''],
  ['Котова Алина','','79191841830','',0,'8 трень 1 мес 21.05.24','','Приветственное инст'],
  ['Зиборова Елена','','79036515054','',0,'1 мес, 3 мес 8.07.24','',''],
  ['Байбакова Елена','','79518697816','',0,'8 трень, 3 мес 11.06.24','',''],
  ['Грома Екатерина','','79202124604','',0,'8 трень 3 шт, 12 трень 23.07.24','','вацап'],
  ['Шипилова Кристина','','79518512660','',0,'1 мес 01.03.24','','вацап'],
  ['Кобарженкова Арина','','79616166050','',0,'1 мес, 8 трень 10.04.24','',''],
  ['Волкова Наталия','','79204000475','',0,'8 трень 1.03.24','',''],
  ['Смирнова Алина','','79066770480','',0,'8 трень 15.03.24','',''],
  ['Черемушкина Олеся','','79518526494','',0,'8 трень 25.02.24','',''],
  ['Сорокина Екатерина','','79611865357','',0,'8 трень 23.02.24','',''],
  ['Колесник Елена','','79507520403','',0,'8 трень 20.02.24','',''],
  ['Ананьева Яна','','79515461240','',0,'1 мес, 3 мес 16.06.24','','рассылка ВК'],
  ['Лысенко Мария','','79202224710','',0,'3 мес 14.05.24','',''],
  ['Овчинникова Елена','','79204577733','',0,'8 трень 23.04.24','','рассылка ВК'],
  ['Курасова Екатерина','','79601333999','',0,'8 трень 2 шт, 3 мес 30.06.24','',''],
  ['Москаленко Надежда','','79616168594','',0,'3 мес. 25.05.24','',''],
  ['Антоненко Дарья','','79913267284','',0,'8 трень, 12.02.24','',''],
  ['Боклашева Елена','','79803488969','',0,'8 трень 25.04.24','',''],
  ['Лех Наталья','','79525504112','',0,'8 перс, 16 перс, 12 перс 17.07.24','','Приветственное инст'],
  ['Переслыцких Юлия','','79038549154','',0,'1 мес 20.02.24','','вацап'],
  ['Шестакова Валерия','','79066740737','',0,'8 трень 18.01.24','',''],
  ['Погореловская Ангелина','','79304300666','',0,'12 трень 11.03.24','','рассылка ВК'],
  ['Долгих Виктория','','79038529985','',0,'1 мес 9.01.24','',''],
  ['Белолипецкая Анжелика','','79009457276','',0,'1 мес 7.01.24','',''],
  ['Карионова Виктория','','79081483202','',0,'8 трень 25.01.24','',''],
  ['Алексеева Наталья','','79304011379','',0,'3 мес 8.03.24','','карты'],
  ['Воронова Илона','','79535071499','',0,'12 трень 5.02.24','',''],
  ['Чаевцева Милана','','79103488946','',0,'1 мес 20.12.23','',''],
  ['Махнева Татьяна','','79601029371','',0,'3 мес 25.02.24','',''],
  ['Федосова Наталья','','79515663718','',0,'3 мес 2 шт 10.06.24','',''],
  ['Павлова Оксана','','79134954833','',0,'12 трень 16.01.24','','вацап'],
  ['Носова Яна','','79204332922','',0,'3 мес 1.03.24','',''],
  ['Иванова Ирина Игоревна','','79507794618','',0,'8 трень 4.01.24','',''],
  ['Желновакова Софья','','79913225309','',0,'8 трень 20.12.23','','Приветственное инст'],
  ['Карионова Анастасия Павловна','','79099546467','',0,'3 мес 4.03.24','',''],
  ['Закоян Анушик','','79081313063','',0,'3 мес 2 аба, 8 трень 12.07.24','',''],
  ['Субанкулова Яна','','79601155662','',0,'16 тр 9.03.24','',''],
  ['Старук Лера','','79009613193','',0,'16 перс тр 26.02.24','',''],
  ['Серикова Валерия','','79964514753','',0,'3 мес 29.04.24','',''],
  ['Гордий Александра','','79511482771','',0,'3 аб по 1 мес 2.07.24','','авито'],
  ['Ткаченко Анна','','79803403202','',0,'3 мес 13.02.24','',''],
  ['Хаустова Виолетта','','79805315711','',0,'12 тр 26.01.24','',''],
  ['Дунаева Екатерина','','79515559512','',0,'','','авито'],
  ['Андреева Мария','','79805324041','',0,'3 мес б 28.11.23','',''],
  ['Питиримова Софья','','79850783637','',0,'8 тр 18.01.24','',''],
  ['Лихачева Любовь','','79518626517','',0,'8 тр 21.05.24','','рассылка ВК'],
  ['Застрожнова Анна','','79504317888','',0,'','','рассылка ВК'],
  ['Будаловская Валерия','','79518559051','',0,'1 мес б 06.12.23','',''],
  ['Лобова Марина','','79087864664','',0,'8 тр 30.11.23','',''],
  ['Власова Полина','','79102882955','',0,'8 тр 01.12.23','','вацап'],
  ['Алиева Ольга','','79304009472','',0,'','',''],
  ['Зайцева Екатерина','','79204469567','',0,'','',''],
  ['Коваленко Дарья','','79803932671','',0,'','',''],
  ['Королева Ольга','','79507676669','',0,'8 тр 10.01.24','',''],
  ['Путилова Дарья','','79137294271','',0,'1 мес б 28.02.24','',''],
  ['Кретова Карина','','79515643905','',0,'','',''],
  ['Полукарпова Ксения','','79802465590','',0,'','',''],
  ['Воронина Алина','','79802419711','',0,'12 тр 17.12.23','',''],
  ['Нефедова Ольга','','79103613884','',0,'8 тр 03.06.24','',''],
  ['Козлова Виктория','','79051709907','',0,'1 мес б 12.01.24','',''],
  ['Качанова Дарья','','79038674603','',0,'3 мес б 25.01.24','',''],
  ['Бавыкина Ольга','','79623325282','',0,'8 тр 29.11.23','',''],
  ['Полякова Ольга','','79155499424','',0,'3 мес б 14.03.24','','рассылка ВК'],
  ['Говорова Юлия','','79081369000','',0,'8 тр 24.02.24','',''],
  ['Хрусталева Нина','','79515540335','',0,'8 тр 29.11.23','','рассылка ВК'],
  ['Малькова Наталья','','79204153038','',0,'1 мес б 10.11.23','',''],
  ['Кулакова Анастасия','','79515604647','',0,'8 тр 01.12.23','',''],
  ['Бузулерова Жанна','','79191864712','',0,'8 тр 05.11.23','',''],
  ['Лапатина Ксения','','79102868011','',0,'','',''],
  ['Власова Ульяна','','79525461025','',0,'','',''],
  ['Черенкова Екатерина','','79529507215','',0,'1 мес б 28.10.23','',''],
  ['Коновалова Алина','','79522958804','',0,'3 мес б 26.02.24','',''],
  ['Монтус Анастасия','','79601239746','',0,'1 мес б 16.11.23','',''],
  ['Петрушкина Мария','','79115857042','',0,'8 тр 1.11.23','','Приветственное инст'],
  ['Некрич Анастасия','','79803461570','',0,'1 мес б 9.11.23','',''],
  ['Кваско Софья','','79518696237','',0,'1 мес б 3.11.23','','авито'],
  ['Яцкина Елена','','79525463455','',0,'12 тр 13.11.23','',''],
  ['Курьянова Юлия','','79601100671','',0,'1 мес б 7.07.24','',''],
  ['Баркалова Татьяна','','79518526664','',0,'8 тр 03.01.24','','вк'],
  ['Войлокова Олеся','','79042106996','',0,'8 тр 23.12.23','',''],
  ['Копа Валерия','','79192387410','',0,'1 мес б 22.10.23','',''],
  ['Павлова Юлия','','79518694931','',0,'8 тр 1.12.23','','Приветственное инст'],
  ['Толстых Ирина','','79531196775','',0,'1 мес б 17.11.23','',''],
  ['Козлова Анастасия','','79529517935','',0,'16 тр 9.12.23','',''],
  ['Болдакова Маргарита','','79964526757','',0,'','','карты'],
  ['Пронина Анастасия','','79699790201','',0,'8 тр 06.11.23','','Приветственное инст'],
  ['Шульженко Юлия','','79802440176','',0,'1 мес б 08.11.23','',''],
  ['Попова Анастасия','','79515600171','',0,'1 мес б 1.12.23','',''],
  ['Болгова Ольга','','79192568039','',0,'6 мес б 12.03.24','',''],
  ['Королева Анастасия','','79507786596','',0,'12 тр 10.03.24','',''],
  ['Жуйко Виктория','','79507721929','',0,'3 мес б 04.01.24','',''],
  ['Федосова Полина','','79087803328','',0,'3 мес б 30.11.23','','Приветственное инст'],
  ['Мезго Ольга','','79009325522','',0,'3 мес б 03.03.24','','рассылка ВК'],
  ['Лещева Елизавета','','79009517722','',0,'6 мес б 16.05.24','','рассылка ВК'],
  ['Прещепа Юлия','','79518626189','',0,'8 тр 23.09.23','',''],
  ['Федорова Нина','','79204063005','',0,'1 мес б 14.09.23','',''],
  ['Свинаренко Альбина','','79611825734','',0,'12 тр 01.11.23','',''],
  ['Горбунова Снежана','','79202118039','',0,'1 мес б 21.09.23','',''],
  ['Якимова Юлия','','79009292096','',0,'1 мес б 13.09.23','',''],
  ['Ревина Марина Викторовна','','79518583529','',0,'12 тр 7.10.23','',''],
  ['Романова Ксения','','79102401346','',0,'6 мес 16.03.24','',''],
  ['Тищенко Анна','','79803874293','',0,'8 трень 16.09.23','',''],
  ['Сотникова Анна','','79515685786','',0,'8 трень 16.09.23','',''],
  ['Ховайко Анастасия','','79515642304','',0,'8 трень 2.09.23','',''],
  ['Бузаева Светлана','','79009260631','',0,'1 месяц 8.09.23','',''],
  ['Савельева Оксана-Ксения','','79086045386','',0,'1 мес 1.09.23','','Приветственное инст'],
  ['Зубкова-Погорелова Светлана','','79515470436','',0,'1 мес, 3 мес 24.12.23','','рассылка ВК'],
  ['Смольянинова Надежда','','79056559109','',0,'6 мес. 7.05.24','',''],
  ['Пятина Софья','','79066720192','',0,'8 трень 18.08.23','','карты'],
  ['Ерофеева Надежда','','79181487519','',0,'8 трень 18.08.23','','карты'],
  ['Чукина Алена','','79081394625','',0,'1 мес 6.09.23','',''],
  ['Евтухова Наталья','','79518705220','',0,'1 мес 3.08.23','','Приветственное инст'],
  ['Пархоменко Мария','','79515445965','',0,'7 дней, 3 мес безлим 11.05.23','',''],
  ['Выборная Лилия Романовна','','79202150833','',0,'24 трени, перс 2.01.23','',''],
  ['Леженина Елена','','79009616246','',0,'3 аба по 8 трень 16.11.23','',''],
  ['Миханоша Екатерина','','79102897481','',0,'8 тр 08.07.23','',''],
  ['Сушкова Елена','','79304064089','',0,'8 тр 06.07.23','','Приветственное инст'],
  ['Савельева Алена','','79009604276','',0,'2 мес 23.07.24','',''],
  ['Гонтаренко Виктория','','79009318853','',0,'8 тр 30.06.23','',''],
  ['Магомедова Динара','','79011931097','',0,'1 мес 24.06.23','',''],
  ['Колесникова Людмила','','79601358506','',0,'1 мес 26.06.23','',''],
  ['Кудаева Анастасия','','79011930178','',0,'1 мес и 12 мес 25.06.24','',''],
  ['Котлова Анастасия','','79009305663','',0,'1 мес 15.06.23','','рассылка ВК'],
  ['Белых Наталья','','79220608120','',0,'1 мес 12.07.23','',''],
  ['Шпилева Галина','','79204479290','',0,'8 тр 02.07.23','',''],
  ['Новикова Татьяна','','79042109892','',0,'12 тр и 8 тр 11.06.24','','рассылка ВК'],
  ['Чурилова Ирина','','79525502107','',0,'3 мес 23.07.23','',''],
  ['Россочинская Марина','','79081461855','',0,'8 тр 18.05.23','',''],
  ['Овчарова Светлана','','79518574336','',0,'2 аб по 8 тр 13.09.23','',''],
  ['Кулюк Майя','','79065845029','',0,'8 перс тр 11.06.23','',''],
  ['Черных Ольга','','79050515474','',0,'16 тр 23.07.23','',''],
  ['Воробьева Анастасия','','79520400062','',0,'марафон 30.05.23','',''],
  ['Сафонова Анастасия','','79042114425','',0,'марафон 30.05.23','',''],
  ['Рогатнева Арина','','79525451255','',0,'4 аб по 12 тр 17.02.24','',''],
  ['Митина Евгения','','79515423831','',0,'3 мес 20.08.23','',''],
  ['Долгова Алина','','79009540652','',0,'марафон 10.06.23','','вацап'],
  ['Тюлькина Екатерина','','79155523565','',0,'8 тр 30.04.23','',''],
  ['Ушкина Ольга','','79192349430','',0,'2 аб по 3 мес 13.10.23','',''],
  ['Светличная Елена','','79515557660','',0,'1 мес 21.04.23','',''],
  ['Торопыгина Ирина','','79529505289','',0,'3 мес 20.06.23','',''],
  ['Кокорева Марина','','79300110217','',0,'8 тр 22.04.23','',''],
  ['Федорова Анжелика','','79304018985','',0,'8 тр 18.04.23','',''],
  ['Красикова Валерия','','79108873549','',0,'8 тр 17.04.23','','авито'],
  ['Зубкова Екатерина','','79518679269','',0,'8 тр 30.03.23','',''],
  ['Кутищева Виктория','','79513060605','',0,'2 аб по 1 мес 18.05.23','',''],
  ['Шулекина Анна','','79507677945','',0,'8 тр 6.04.23','',''],
  ['Абиева Иман','','79204410494','',0,'1 мес 31.05.23','',''],
  ['Короткова Екатерина','','79518486965','',0,'8 тр 2 аб 17.05.23','','авито'],
  ['Устименко Оксана','','79518596554','',0,'8 тр, 3 аб по 1 мес 12.07.23','','вацап'],
  ['Селиверстова Ксения','','79515595945','',0,'1 мес 04.04.23','','вацап'],
  ['Дуракова Наталья','','79056572104','',0,'3 аб 8 тр 03.06.23','',''],
  ['Крипак Виктория','','79525507073','',0,'2 аб по 1 мес 29.04.23','',''],
  ['Попова Анастасия Павловна','','79204130091','',0,'6 мес 06.09.23','',''],
  ['Гребенюк Елена','','79525518961','',0,'2 аб 8 тр 23.05.23','',''],
  ['Лебедева Елена Геннадьевна','','79515521175','',0,'2 аб 1 мес 19.04.23','','авито'],
  ['Лавренова Марина','','79507715949','',0,'1 мес 28.03.23','',''],
  ['Нестерчук Екатерина','','79885355817','',0,'8 тр 12 тр 19.05.24','',''],
  ['Полякова Екатерина Владимировна','','79050531282','',0,'2 аб 1 мес 22.04.23','',''],
  ['Жихарева Оксана','','79204608661','',0,'8 тр 1 мес 16.03.23','','вацап'],
  ['Иванюк Наталия','','79204188099','',0,'1 мес 05.03.23','',''],
  ['Серая Ольга','','79525438404','',0,'7 дней 27.03.23','',''],
  ['Волкова Ангелина','','79013495482','',0,'марафон 31.03.23','',''],
  ['Рудич София','','79623317302','',0,'8 тр 1 мес 18.05.23','',''],
  ['Морозова Кристина','','79081300157','',0,'марафон, 1 мес 06.05.23','',''],
  ['Полухина Валерия','','79518586373','',0,'7 дней 31.03.23','','рассылка ВК'],
  ['Камышова Виктория','','79518623386','',0,'2 аб по 12 тр, 3 мес 27.04.24','',''],
  ['Камышова Марина Игоревна','','79515623434','',0,'2 аб по 12 тр, 3 мес 27.04.24','',''],
  ['Аникеенко Мария','','79103449865','',0,'12 тр 25.03.23','',''],
  ['Чернышова Олеся','','79010931190','',0,'4 аб по 8 тр, 12 мес 2.06.24','',''],
  ['Муратова Анастасия','','79081313821','',0,'3 мес 29.04.23','',''],
  ['Киреевская Екатерина','','79660861155','',0,'12 трень 22.03.23','',''],
  ['Очеретяная Ольга','','79009516430','',0,'8 тр 28.04.23','','рассылка ВК'],
  ['Казаку Кристина','','79507614323','',0,'1 мес 29.04.23','','вацап'],
  ['Колчева Алина','','79009278651','',0,'4 по 8 трень 15.11.23','',''],
  ['Шурховецкая Ольга','','79304165418','',0,'3 мес 17.04.23','',''],
  ['Терещенко Татьяна','','79042147469','',0,'8 трень 18.02.23','',''],
  ['Новохатько Елизавета','','79204228655','',0,'1 мес 21.02.23','',''],
  ['Мозолевская Инна','','79092110551','',0,'марафон 7.04.23','','рассылка ВК'],
  ['Синюкова Юлия','','79507567642','',0,'3 мес 4.05.23','',''],
  ['Павловская Виктория','','79204132855','',0,'3 мес 01.05.23','',''],
  ['Миханоша Анна','','79204470137','',0,'8 тр 12.03.23','',''],
  ['Кудинова Наталья','','79803438802','',0,'8 тр 19.03.23','',''],
  ['Федорова Наталья','','79518702618','',0,'1 мес 13.01.23','',''],
  ['Трегубова Юлия','','79155502706','',0,'8 тр 28.01.23','',''],
  ['Чусова Анна','','79601155885','',0,'','',''],
  ['Панютина Яна','','79515678818','',0,'','',''],
  ['Лебедева Диана','','79810890012','',0,'','',''],
  ['Татаринова Софья','','79042803978','',0,'','',''],
  ['Фёдорова Вероника Алексеевна','','79610280808','',0,'','',''],
  ['Касьянова Анна','','79307773357','',0,'','',''],
  ['Болдарева Екатерина','','79507637221','',0,'','',''],
  ['Павельева Дарья','','79957199462','',0,'нет аб','',''],
  ['Щеглова Алена дублик','','79100405624','',0,'','',''],
  ['Темчук Андрея','','79081389733','',0,'8 трень, 12 трень 19.07.24','','проходящий трафик'],
];

const CVETNOI_RAW_V3: RawClient[] = [
  ['Мозолевская Инна','','79092110551','',0,'марафон 7.04.23','','рассылка ВК'],
  ['Синюкова Юлия','','79507567642','',0,'3 мес 4.05.23','',''],
  ['Пахомова Ксения','','79529561972','',0,'8 тр 22.02.23','','рассылка ВК'],
  ['Алексеева Ксения','','79048966498','',0,'7 дней 22.03.23','',''],
  ['Дегтерёва Юлия','','79288436782','',0,'2 аб 1 мес 6.05.23','',''],
  ['Корзенкова Кристина','','79507606488','',10700,'3 аб 8 тр 11.05.24','',''],
  ['Кузнецова Татьяна Д','','79529580071','',0,'8 тр 10.03.23','','рассылка ВК'],
  ['Волкова Виктория Сергеевна','','79518781894','',0,'1 мес и 3 мес 5.05.23','',''],
  ['Кобелева Маргарита','','79202271574','',0,'3 по 8 тр 2.06.23','',''],
  ['Головкина Надежда','','79065847217','',0,'1 мес 5.02.23','',''],
  ['Анвури Оксана','','79042142958','',0,'8 тр, 2 аб 1 мес 7.01.24','',''],
  ['Мельникова Анна','','79175574688','',0,'8 тр 1 мес','',''],
  ['Кононенко Алина','','79997208292','',0,'8 тр, 3 аб 1 мес 21.06.23','',''],
  ['Кобелева Ирина','','79525589005','',0,'3 аб 8 тр 2.06.23','','рассылка ВК'],
  ['Губанова Наталья','','79515463935','',0,'2 аб 12 тр 23.10.23','','рассылка ВК'],
  ['Храпко Елена','','79304008444','',0,'1 мес 17.02.23','',''],
  ['Габинет Антонина','','79036562231','',0,'2 аб 1 мес 27.05.23','','авито'],
  ['Неупокоева Татьяна','','79805485111','',0,'6 мес 23.09.23','',''],
  ['Золоторева Алена','','79191845695','',0,'1 мес 9.02.23','',''],
  ['Чиркова Дарья','','79511315792','',0,'2 по 8 тр 23.02.23','',''],
  ['Афоненко Екатерина','','79036566397','',0,'8 тр 22.02.23','',''],
  ['Огурцова Мария','','79507767965','',0,'3 мес 20.03.23','','рассылка ВК'],
  ['Политкина Варвара','','79631059615','',0,'1 и 6 мес 05.11.23','',''],
  ['Ефанова Анастасия','','79873560434','',0,'6 мес и 2аб по 1 мес 1.06.24','',''],
  ['Дегтярева Евгения','','79507705808','',0,'7 дней 30.11.22','',''],
  ['Царенко Светлана','','79204426341','',0,'1 мес 14.12.22','',''],
  ['Коновалова Анастасия','','79614962310','',0,'8 тр 29.12.22','','вацап'],
  ['Дармодехина Елена','','79518731522','',0,'2аб 8 тр 29.01.23','',''],
  ['Теплинская Валерия','','79518584349','',0,'1 мес 9.12.22','',''],
  ['Белокопытова Яна','','79507796320','',0,'2аб 1 мес','',''],
  ['Копытова Алина','','79805368022','',0,'8 тр 21.12.22','','авито'],
  ['Рубцова Виктория','','79038512129','',0,'1 мес 05.12.22','',''],
  ['Светашова Юлия','','79518725185','',0,'8тр 2.12.22','',''],
  ['Арефьева Елена','','79507505004','',0,'12тр 10.01.23','',''],
  ['Ключникова Наталья','','79042110751','',0,'1 и 3 мес 9.05.23','',''],
  ['Сергиенко Эльвира','','79507613177','',0,'2 по 8 тр 13.01.23','','рассылка ВК'],
  ['Карлова Анастасия','','79914064974','',0,'марафон,8тр,2 мес 20.06.24','',''],
  ['Петина Елена','','79204073830','',0,'8тр 16.11.22','','рассылка ВК'],
  ['Рубцова Валерия','','79524299770','',0,'12 мес б 26.12.23','','рекомендации клиента'],
  ['Никольская Ольга','','79009459640','',0,'8 тр 02.11.22','',''],
  ['Семенченко Татьяна','','79204290336','',0,'8 тр 11.12.23','',''],
  ['Гетманская Галина','','79204271712','',0,'12 мес б 28.09.23','',''],
  ['Неклесова Маргарита','','79518739966','',0,'12 мес б 14.10.23','',''],
  ['Чусова Яна','','79518647096','',0,'12 мес б 05.11.23','','Приветственное инст'],
  ['Сматченко Екатерина','','79202038987','',0,'1 мес б 02.11.22','','Приветственное инст'],
  ['Казьмина Анастасия','','79601083111','',0,'8 тр 04.05.23','',''],
  ['Бугакова Елизавета','','79009483416','',0,'8 тр 28.05.23','',''],
  ['Беляева Елена Б','','79515539634','',0,'8 перс тр 22.03.23','',''],
  ['Ялынская Снежана','','79087862197','',0,'8 тр 27.09.22','',''],
  ['Шипилова Екатерина','','79204462615','',0,'1 мес б 23.09.22','',''],
  ['Бузовкина Мария','','79529579598','',0,'12 мес б 1.06.24','','Приветственное инст'],
  ['Лесникова Ольга','','79011936743','',0,'1 мес б 14.06.23','','вацап'],
  ['Дворяткина Анастасия','','79003045429','',0,'1 мес б 21.09.22','','Приветственное инст'],
  ['Горлина Александра','','79805468332','',0,'8 тр 23.09.22','',''],
  ['Королева Оксана','','79507674903','',0,'Марафон 12.12.22','','Приветственное инст'],
  ['Щебланова Вероника','','79611846818','',0,'Марафон 12.12.22','','Приветственное инст'],
  ['Стрельникова Людмила','','79803427581','',0,'Марафон 5.12.22','','Приветственное инст'],
  ['Мишкова Ирина','','79202181636','',0,'Марафон 2.12.22','',''],
  ['Гунькова Кристина','','79009458056','',0,'8 тр 09.05.23','',''],
  ['Стребкова Валерия','','79038508579','',0,'8 тр 07.03.23','','вацап'],
  ['Переславцева Яна','','79204249158','',0,'8 тр 24.04.23','',''],
  ['Жиброва Татьяна','','79081427842','',0,'12 тр 26.03.23','',''],
  ['Исмаилова Елена','','79009626878','',0,'8 тр 20.11.22','',''],
  ['Головина Людмила','','79525453707','',0,'1 мес б 14.09.22','',''],
  ['Цурикова Виктория','','79952507713','',0,'8 тр 15.11.22','',''],
  ['Колабаева Елена','','79507529507','',0,'12 мес б 06.08.23','',''],
  ['Топалян Гаяна','','79107468503','',0,'1 мес б 27.10.22','',''],
  ['Тарасова Виктория Б','','79611815911','',0,'16 тр 10.04.23','','Приветственное инст'],
  ['Кобзева Мария','','79802462751','',0,'7 дней безл 28.03.23','',''],
  ['Горчячих Полина','','79539591618','',0,'3 мес б 26.08.22','',''],
  ['Кузнецова Татьяна И','','79521041944','',0,'12 мес б 31.07.23','',''],
  ['Карими Саар','','79529594956','',0,'1 мес б 03.11.23','','Приветственное инст'],
  ['Исаева Валерия','','79611890981','',0,'8 тр 07.11.22','',''],
  ['Казакова Алена','','79518799051','',0,'8 тр 08.11.22','','Приветственное инст'],
  ['Маричук Надежда','','79092159610','',0,'12 тр 15.09.22','',''],
  ['Острикова Светлана','','79081387055','',0,'8 тр 07.07.22','','Приветственное инст'],
  ['Ефремова Оксана','','79092105604','',0,'8 тр 30.09.22','',''],
  ['Аносова Светлана','','79191845797','',0,'12 мес б 20.08.23','',''],
  ['Попова Юлия Б','','79081430165','',0,'1 мес б 14.09.22','',''],
  ['Литягина Юлия','','79601216321','',31320,'12 мес б 29.08.23','','вацап'],
  ['Копылова Ирина','','79525964739','',0,'8 тр 25.01.23','','рассылка ВК'],
  ['Котова Эльвира','','79304110082','',0,'12 тр 31.08.22','','рассылка ВК'],
  ['Якимова Татьяна Б','','79805356997','',0,'8 тр 24.01.23','',''],
  ['Мозговая Александра','','79515542429','',0,'8 тр 04.08.22','',''],
  ['Липпс Ольга','','79192439285','',0,'12 мес б 01.09.23','',''],
  ['Шигун Елена','','79529599080','',0,'12 мес б 26.11.23','',''],
  ['Рыбникова Анастасия','','79003004509','',0,'1 мес б 28.07.22','','Приветственное инст'],
  ['Авдеева Ксения','','79191888087','',0,'7 дн б 16.03.23','','Приветственное инст'],
  ['Корнева Яна','','79600287373','',0,'12 мес б 21.06.23','',''],
  ['Литвинова Маргарита','','79205705498','',0,'3 мес б 07.11.22','',''],
  ['Пономарева Анастасия','','79521052957','',0,'12 мес б 04.07.23','',''],
  ['Зайченко Ирина','','79205991820','',0,'1 мес б 02.11.22','',''],
  ['Воронина Алина Б','','79507532725','',0,'1 мес б 08.04.24','',''],
  ['Зайцева Ольга','','79191840014','',0,'12 мес б 17.07.23','',''],
  ['Голдинова Елизавета','','79056584722','',0,'1 мес б 01.09.22','',''],
  ['Афанасьева Влада','','79009507280','',0,'3 мес б 19.09.22','',''],
  ['Кумпанич Юлия','','79515685868','',0,'1 мес б 25.11.22','',''],
  ['Мельникова Юлия','','79802475482','',4200,'12 мес б 30.10.23','',''],
  ['Власова Анастасия','','79042215362','',0,'12 мес б 14.08.23','',''],
  ['Зиборова Екатерина','','79191827521','',0,'6 мес б 03.07.23','',''],
  ['Дронова Алина','','79529598596','',0,'','','Приветственное инст'],
  ['Зверева Наталья','','79507601497','',0,'','','авито'],
  ['Гончарова Ева','','79805261554','',0,'','',''],
  ['Коломиец Ольга','','79003022932','',0,'','','Приветственное инст'],
  ['Тимофеенко Екатерина','','79204500372','',0,'','',''],
  ['Шуманева Валерия','','79601174165','',0,'','',''],
  ['Провоторова Елена','','79515492220','',0,'','','вацап'],
  ['Потамошнева Елизавета','','79204394743','',0,'','',''],
  ['Самофалова Александра','','79204182955','',0,'','','вацап'],
  ['Ивон Лана','','79204341414','',0,'','','Приветственное инст'],
  ['Кузнецова Юлия Б','','79601034220','',0,'','',''],
  ['Лепская Алена','','79002215318','',0,'','',''],
  ['Денисова Виктория','','79525517343','',0,'','','рассылка ВК'],
  ['Жугонина Екатерина','','79507721708','',0,'','',''],
  ['Мадесова Елена','','79192441286','',0,'','',''],
  ['Горячевская Ирина','','79304102351','',0,'','',''],
  ['Давудова Анжела','','79529761084','',0,'','',''],
  ['Артемова Екатерина','','79509214696','',0,'','',''],
  ['Маркова Евгения','','79684944228','',0,'','',''],
  ['Лепихова Виктория','','79009453601','',0,'','','Приветственное инст'],
  ['Золоторева Ирина','','79158880806','',0,'','',''],
  ['Евдокимова Мария','','79003057512','',0,'','','Приветственное инст'],
  ['Якимова Валентина','','79518747651','',0,'24 перс 12 отходила','','Приветственное инст'],
  ['Михайлова Ирина','','79204219880','',0,'','',''],
  ['Дорохина Тамара','','79515509485','',0,'','',''],
  ['Афанасьева Светлана','','79507622585','',0,'','',''],
  ['Власова Марина','','79205666069','',0,'','','Приветственное инст'],
  ['Ненахова Инна','','79802449335','',0,'','',''],
  ['Толстова Юлия','','79507606209','',0,'','',''],
  ['Мельник Галина','','79304043917','',0,'','',''],
  ['Доронина Татьяна','','79009448834','',0,'','',''],
  ['Флусова Елизавета','','79304182921','',0,'','','авито'],
  ['Казарина Ангелина','','79191897621','',0,'','',''],
  ['Орехова Юлия','','79515450130','',0,'','','рассылка ВК'],
  ['Скасырская Анна','','79191866763','',0,'','','вацап'],
  ['Проскурина Анна','','79521010598','',0,'','',''],
  ['Едрышова Ирина','','79304234567','',0,'','',''],
  ['Черникова Дарья','','79601345368','',0,'','',''],
  ['Володина Анастасия','','79507750784','',0,'','',''],
  ['Михель Ирина','','79304102263','',0,'','',''],
  ['Краснолуцкая Елена','','79611889988','',0,'','',''],
  ['Николаева Татьяна','','79036515888','',0,'','',''],
  ['Костенко Наталья','','79081358901','',0,'','',''],
  ['Павлюк Татьяна','','79102459268','',0,'','',''],
  ['Запольская Елена','','79515605842','',0,'','','рассылка ВК'],
  ['Иванова Ирина Б','','79777760595','',0,'','',''],
  ['Губанова Александра','','79515529132','',0,'','','Приветственное инст'],
  ['Ярошенко Светлана','','79042113638','',0,'','',''],
  ['Тонконог Светлана','','79515604975','',0,'','',''],
  ['Каруца Людмила','','79521006240','',4200,'','',''],
  ['Козочкина Алина','','79805321992','',0,'','',''],
  ['Манжос Елизавета','','79601066291','',0,'','',''],
  ['Калатур Мария','','79042131503','',0,'','',''],
  ['Валикова Алина','','79204161284','',0,'','',''],
  ['Тарасова Александра','','79507679715','',0,'','',''],
  ['Зайцева Лада','','79038584854','',0,'','','вацап'],
  ['Мамонтова Светлана','','79081401281','',0,'','','вацап'],
  ['Блащенко Ольга','','79515697687','',0,'','',''],
  ['Волкова Екатерина Б','','79803462038','',0,'','',''],
  ['Бедченко Кристина','','79066737260','',0,'','','вацап'],
  ['Семенова Марина','','79081424376','',0,'','',''],
  ['Просветова Ольга','','79805573230','',0,'','',''],
  ['Шаповалова Юлия','','79525556084','',0,'','',''],
  ['Пастушкова Алена','','79525580968','',0,'','','рассылка ВК'],
  ['Турищева Людмила','','79525513094','',0,'','',''],
  ['Казарина Надежда','','79204018803','',0,'потянула ногу','',''],
  ['Сукачева Александра','','79202119020','',0,'','','Приветственное инст'],
  ['Холодова Юлия','','79042148647','',0,'','','Приветственное инст'],
  ['Ватутина Елена','','79516622013','',0,'','',''],
  ['Шабанина Ольга','','79192334268','',0,'','',''],
  ['Жукова Анастасия','','79092222420','',0,'','',''],
  ['Погорелова Екатерина','','79081302461','',0,'','',''],
  ['Костенюкова Елена','','79202169597','',0,'','','Приветственное инст'],
  ['Пугачева Наталья','','79525544083','',0,'','','вацап'],
  ['Расулева София','','79092107700','',0,'','','вацап'],
  ['Самойлова Мария','','79204376917','',0,'','',''],
];

function applyImportV3(state: AppState): AppState {
  const branches = [...state.branches];
  const cvetnoiId = branches.find(b => b.name.toLowerCase().includes('цветной'))?.id ?? 'b_cvetnoi';

  const existingPhones = new Set(state.clients.map(c => c.phone.replace(/\D/g, '')));
  const newClients: Client[] = [];
  let idx = 0;
  for (const row of CVETNOI_RAW_V3) {
    const [col1, col2, phone, bdate, spent, comment, lastVisit, catRaw] = row;
    const phoneClean = String(phone).replace(/\D/g, '');
    if (!phoneClean || existingPhones.has(phoneClean)) continue;
    existingPhones.add(phoneClean);
    const { firstName, lastName, middleName } = parseName(String(col1), String(col2));
    if (!firstName && !lastName) continue;
    newClients.push({
      id: `cv3_${Date.now()}_${idx++}`,
      firstName, lastName, middleName,
      phone: phoneClean, contactChannel: 'phone', referralSource: '',
      adSource: mapAdSource(String(catRaw)),
      birthDate: String(bdate || ''),
      comment: String(comment || ''),
      branchId: cvetnoiId,
      createdAt: '2026-01-01',
      activeSubscriptionId: null,
      importedSpent: Number(spent) || 0,
      dashboardExclude: true,
      lastVisitDate: String(lastVisit || ''),
      importedStatus: parseImportedStatus(String(lastVisit)),
    });
  }
  return { ...state, branches, clients: [...state.clients, ...newClients] };
}

function applyCvetnoiImport(state: AppState): AppState {
  let branches = [...state.branches];
  let cvetnoiId = branches.find(b => b.name.toLowerCase().includes('цветной') || b.name.toLowerCase().includes('цветн'))?.id;
  if (!cvetnoiId) {
    cvetnoiId = 'b_cvetnoi';
    branches = [...branches, { id: cvetnoiId, name: 'Цветной', address: 'Цветной бульвар', phone: '' }];
  }

  const existingPhones = new Set(state.clients.map(c => c.phone.replace(/\D/g, '')));
  const newClients: Client[] = [];
  let idx = 0;
  for (const row of CVETNOI_RAW) {
    const [col1, col2, phone, bdate, spent, comment, lastVisit, catRaw] = row;
    const phoneClean = String(phone).replace(/\D/g, '');
    if (existingPhones.has(phoneClean)) continue;
    existingPhones.add(phoneClean);
    const { firstName, lastName, middleName } = parseName(String(col1), String(col2));
    if (!firstName && !lastName) continue;
    const adSource = mapAdSource(String(catRaw));
    const importedStatus = parseImportedStatus(String(lastVisit));
    const birthDateRaw = String(bdate || '');
    const birthDate = birthDateRaw ? birthDateRaw.split('T')[0] : '';
    newClients.push({
      id: `cv_${Date.now()}_${idx++}`,
      firstName,
      lastName,
      middleName,
      phone: phoneClean,
      contactChannel: 'phone',
      referralSource: '',
      adSource,
      birthDate,
      comment: String(comment || ''),
      branchId: cvetnoiId,
      createdAt: '2026-01-01',
      activeSubscriptionId: null,
      importedSpent: Number(spent) || 0,
      dashboardExclude: true,
      lastVisitDate: String(lastVisit || ''),
      importedStatus,
    });
  }
  return { ...state, branches, clients: [...state.clients, ...newClients] };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backward compat: добавляем новые поля если их нет
      const subscriptions = (parsed.subscriptions || []).map((s: Subscription) => ({
        activatedAt: s.activatedAt ?? s.purchaseDate,
        autoActivateDate: s.autoActivateDate ?? null,
        ...s,
        status: (s.status === 'active' || s.status === 'frozen' || s.status === 'expired' || s.status === 'returned' || s.status === 'pending') ? s.status : 'active',
      }));
      const subscriptionPlans = (parsed.subscriptionPlans || []).map((p: SubscriptionPlan) => ({
        autoActivateDays: p.autoActivateDays ?? null,
        ...p,
      }));
      const singleVisitPlans = (parsed.singleVisitPlans || []).map((p: SingleVisitPlan) => ({
        autoActivateDays: p.autoActivateDays ?? null,
        noExtraCharge: p.noExtraCharge ?? false,
        ...p,
      }));
      const trainers = (parsed.trainers || []).map((t: Trainer) => ({
        branchIds: t.branchIds ?? [t.branchId],
        ...t,
      }));
      const trainingTypes = (parsed.trainingTypes || []).map((tt: TrainingType) => ({
        extraPrice: tt.extraPrice ?? null,
        extraPriceName: tt.extraPriceName ?? null,
        ...tt,
      }));
      const base: AppState = {
        ...initialState,
        ...parsed,
        subscriptions,
        subscriptionPlans,
        singleVisitPlans,
        trainers,
        trainingTypes,
        dismissedNotifications: parsed.dismissedNotifications ?? [],
        failedNotifications: parsed.failedNotifications ?? {},
        notificationCategories: parsed.notificationCategories ?? DEFAULT_NOTIFICATION_CATEGORIES,
      };
      // Миграция: импорт базы клиентов Цветной (v2 — полная база)
      if (!base.importedCvetnoiV2) {
        const withoutOld: AppState = {
          ...base,
          clients: base.clients.filter(c => !c.id.startsWith('cv_')),
          branches: base.branches.filter(b => b.id !== 'b_cvetnoi'),
        };
        const merged = applyImportV3(applyCvetnoiImport(withoutOld));
        merged.importedCvetnoiV1 = true;
        merged.importedCvetnoiV2 = true;
        merged.importedCvetnoiV3 = true;
        return merged;
      }
      if (!base.importedCvetnoiV3) {
        const merged = applyImportV3(base);
        merged.importedCvetnoiV3 = true;
        return merged;
      }
      return base;
    }
  } catch (e) { /* ignore */ }
  // Первый запуск — применяем импорт Цветной
  const fresh = applyImportV3(applyCvetnoiImport(initialState));
  fresh.importedCvetnoiV1 = true;
  fresh.importedCvetnoiV2 = true;
  fresh.importedCvetnoiV3 = true;
  return fresh;
}

// URL бэкенда — заполняется после деплоя
const CRM_STATE_URL = (window as unknown as Record<string, string>)['__CRM_STATE_URL__'] || '';

async function saveStateToDb(s: AppState) {
  if (!CRM_STATE_URL) return;
  try {
    await fetch(`${CRM_STATE_URL}?action=state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: s }),
    });
  } catch { /* ignore */ }
}

export async function loadStateFromDb(): Promise<AppState | null> {
  if (!CRM_STATE_URL) return null;
  try {
    const res = await fetch(`${CRM_STATE_URL}?action=state`);
    const json = await res.json();
    return json.data || null;
  } catch { return null; }
}

export async function getAccessToken(): Promise<string> {
  if (!CRM_STATE_URL) return '';
  try {
    const res = await fetch(`${CRM_STATE_URL}?action=token`);
    const json = await res.json();
    return json.token || '';
  } catch { return ''; }
}

export async function regenerateAccessToken(): Promise<string> {
  if (!CRM_STATE_URL) return '';
  try {
    const res = await fetch(`${CRM_STATE_URL}?action=token`, { method: 'POST' });
    const json = await res.json();
    return json.token || '';
  } catch { return ''; }
}

function saveState(s: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  saveStateToDb(s);
}

// Генерирует ссылку со списком сотрудников (логин+пароль) в base64
export function generateStaffLink(staff: StaffMember[]): string {
  const data = staff.map(m => ({
    id: m.id, name: m.name, role: m.role,
    login: m.login || '', email: m.email,
    password: m.password || '',
    branchIds: m.branchIds,
    permissions: m.permissions,
    createdAt: m.createdAt,
  }));
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return `${window.location.origin}${window.location.pathname}?sl=${encoded}`;
}

// Парсит ?sl=... и возвращает список сотрудников
export function parseStaffLink(param: string): StaffMember[] | null {
  try {
    const decoded = decodeURIComponent(escape(atob(param)));
    const data = JSON.parse(decoded);
    if (!Array.isArray(data)) return null;
    return data as StaffMember[];
  } catch { return null; }
}

export function loadAuth(): string | null {
  try { return localStorage.getItem(AUTH_KEY); } catch (e) { return null; }
}

export function saveAuth(staffId: string) {
  try { localStorage.setItem(AUTH_KEY, staffId); } catch (e) { /* ignore */ }
}

export function clearAuth() {
  try { localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
}

export function useStore() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [dbLoaded, setDbLoaded] = useState(false);

  // При первом запуске — пробуем загрузить из БД (приоритет над localStorage)
  useEffect(() => {
    if (dbLoaded) return;
    // Запоминаем staff из localStorage ДО загрузки БД (там могут быть сотрудники из ?sl= ссылки)
    const localStaff = loadState().staff;
    loadStateFromDb().then(dbState => {
      if (dbState) {
        // Если в localStorage есть сотрудники которых нет в БД — сохраняем их (из ?sl= ссылки)
        const dbStaffIds = new Set((dbState.staff || []).map((s: StaffMember) => s.id));
        const extraStaff = localStaff.filter(s => !dbStaffIds.has(s.id));
        const merged: AppState = extraStaff.length > 0
          ? { ...dbState, staff: [...(dbState.staff || []), ...extraStaff] }
          : dbState;
        setState(merged);
        saveState(merged);
      }
      setDbLoaded(true);
    });
  }, []);

  const update = useCallback((updater: (s: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const genId = () => Math.random().toString(36).slice(2, 10);

  // Clients
  const addClient = (client: Omit<Client, 'id' | 'createdAt' | 'activeSubscriptionId'>) => {
    const newClient: Client = { ...client, id: genId(), createdAt: fmt(new Date()), activeSubscriptionId: null };
    update(s => ({ ...s, clients: [...s.clients, newClient] }));
    return newClient;
  };

  const updateClient = (id: string, data: Partial<Client>) => {
    update(s => ({ ...s, clients: s.clients.map(c => c.id === id ? { ...c, ...data } : c) }));
  };

  // Sales & Subscriptions
  const sellSubscription = (
    clientId: string, planId: string, discount: number, paymentMethod: 'cash' | 'card',
    opts?: { saleDate?: string; activationDate?: string; sessionsSpent?: number }
  ) => {
    const plan = state.subscriptionPlans.find(p => p.id === planId);
    if (!plan) return;
    const saleDate = opts?.saleDate ?? fmt(new Date());
    const prevSubs = state.sales.filter(s => s.clientId === clientId && s.type === 'subscription');
    const hadSub = prevSubs.length > 0;
    const lastSale = prevSubs.sort((a, b) => b.date.localeCompare(a.date))[0];
    const isReturn = hadSub && lastSale ? (new Date(saleDate).getTime() - new Date(lastSale.date).getTime()) > 30 * 24 * 60 * 60 * 1000 : false;
    const isRenewal = hadSub && !isReturn;
    const isFirst = !hadSub;
    const finalPrice = Math.round(plan.price * (1 - discount / 100));
    const subId = genId();
    const saleId = genId();
    // Если задан activationDate — абонемент активирован с указанной даты
    // Если задан autoActivateDays (и нет activationDate) — pending
    const hasPendingMode = plan.autoActivateDays != null && !opts?.activationDate;
    const activationDate = opts?.activationDate ?? null;
    const autoActivateDate = hasPendingMode ? fmt(addDays(new Date(saleDate), plan.autoActivateDays!)) : null;
    const endDate = activationDate
      ? fmt(addDays(new Date(activationDate), plan.durationDays))
      : hasPendingMode
        ? fmt(addDays(new Date(saleDate), plan.autoActivateDays! + plan.durationDays))
        : fmt(addDays(new Date(saleDate), plan.durationDays));

    let sessionsLeft: number | 'unlimited' = plan.sessionsLimit;
    if (opts?.sessionsSpent && plan.sessionsLimit !== 'unlimited') {
      sessionsLeft = Math.max(0, (plan.sessionsLimit as number) - opts.sessionsSpent);
    }

    const newSub: Subscription = {
      id: subId, clientId, planId, planName: plan.name,
      purchaseDate: saleDate, endDate,
      sessionsLeft,
      freezeDaysLeft: plan.freezeDays,
      frozenFrom: null, frozenTo: null,
      status: activationDate ? 'active' : hasPendingMode ? 'pending' : 'active',
      price: plan.price, discount, paymentMethod, branchId: plan.branchId,
      activatedAt: activationDate ?? (hasPendingMode ? null : saleDate),
      autoActivateDate,
    };
    const newSale: Sale = {
      id: saleId, clientId, type: 'subscription', itemId: planId, itemName: plan.name,
      price: plan.price, discount, finalPrice, paymentMethod,
      date: saleDate, branchId: plan.branchId,
      isFirstSubscription: isFirst, isReturn, isRenewal
    };
    update(s => ({
      ...s,
      subscriptions: [...s.subscriptions, newSub],
      clients: s.clients.map(c => c.id === clientId ? { ...c, activeSubscriptionId: subId } : c),
      sales: [...s.sales, newSale]
    }));
  };

  const sellSingleVisit = (clientId: string, planId: string, paymentMethod: 'cash' | 'card', opts?: { discount?: number; saleDate?: string }) => {
    const plan = state.singleVisitPlans.find(p => p.id === planId);
    if (!plan) return;
    const saleId = genId();
    const discount = opts?.discount ?? 0;
    const saleDate = opts?.saleDate ?? fmt(new Date());
    const finalPrice = Math.round(plan.price * (1 - discount / 100));
    const newSale: Sale = {
      id: saleId, clientId, type: 'single', itemId: planId, itemName: plan.name,
      price: plan.price, discount, finalPrice, paymentMethod,
      date: saleDate, branchId: plan.branchId,
      isFirstSubscription: false, isReturn: false, isRenewal: false
    };
    update(s => ({ ...s, sales: [...s.sales, newSale] }));
  };

  // Продажа доплаты (extra) за конкретную тренировку
  const sellExtra = (clientId: string, itemName: string, price: number, paymentMethod: 'cash' | 'card', branchId: string) => {
    const saleId = genId();
    const newSale: Sale = {
      id: saleId, clientId, type: 'extra', itemId: 'extra', itemName,
      price, discount: 0, finalPrice: price, paymentMethod,
      date: fmt(new Date()), branchId,
      isFirstSubscription: false, isReturn: false, isRenewal: false
    };
    update(s => ({ ...s, sales: [...s.sales, newSale] }));
  };

  // Subscriptions actions
  const freezeSubscription = (subId: string, days: number) => {
    update(s => ({
      ...s,
      subscriptions: s.subscriptions.map(sub => {
        if (sub.id !== subId) return sub;
        const frozenFrom = fmt(new Date());
        const frozenTo = fmt(addDays(new Date(), days));
        const newEnd = fmt(addDays(new Date(sub.endDate), days));
        return { ...sub, status: 'frozen', frozenFrom, frozenTo, freezeDaysLeft: sub.freezeDaysLeft - days, endDate: newEnd };
      })
    }));
  };

  const unfreezeSubscription = (subId: string) => {
    update(s => ({
      ...s,
      subscriptions: s.subscriptions.map(sub => {
        if (sub.id !== subId || sub.status !== 'frozen') return sub;
        const today = new Date();
        const frozenTo = sub.frozenTo ? new Date(sub.frozenTo) : today;
        const daysUnused = Math.max(0, Math.ceil((frozenTo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        const restoredEnd = daysUnused > 0 ? fmt(addDays(new Date(sub.endDate), -daysUnused)) : sub.endDate;
        return {
          ...sub,
          status: 'active',
          frozenFrom: null,
          frozenTo: null,
          freezeDaysLeft: sub.freezeDaysLeft + daysUnused,
          endDate: restoredEnd,
        };
      })
    }));
  };

  const returnSubscription = (subId: string) => {
    update(s => ({
      ...s,
      subscriptions: s.subscriptions.map(sub => sub.id === subId ? { ...sub, status: 'returned' } : sub),
      clients: s.clients.map(c => c.activeSubscriptionId === subId ? { ...c, activeSubscriptionId: null } : c)
    }));
  };

  const updateSubscription = (subId: string, data: Partial<Subscription>) => {
    update(s => ({ ...s, subscriptions: s.subscriptions.map(sub => sub.id === subId ? { ...sub, ...data } : sub) }));
  };

  // Schedule
  const addScheduleEntry = (entry: Omit<ScheduleEntry, 'id' | 'enrolledClientIds'> & { enrolledClientIds?: string[] }) => {
    const newEntry: ScheduleEntry = { ...entry, id: genId(), enrolledClientIds: entry.enrolledClientIds || [] };
    update(s => ({ ...s, schedule: [...s.schedule, newEntry] }));
    return newEntry;
  };

  const updateScheduleEntry = (id: string, data: Partial<Omit<ScheduleEntry, 'id'>>) => {
    update(s => ({ ...s, schedule: s.schedule.map(e => e.id === id ? { ...e, ...data } : e) }));
  };

  const removeScheduleEntry = (id: string) => {
    update(s => ({ ...s, schedule: s.schedule.filter(e => e.id !== id) }));
  };

  const enrollClient = (scheduleId: string, clientId: string) => {
    update(s => ({
      ...s,
      schedule: s.schedule.map(e => e.id === scheduleId && !e.enrolledClientIds.includes(clientId)
        ? { ...e, enrolledClientIds: [...e.enrolledClientIds, clientId] } : e),
      visits: [...s.visits, { id: genId(), clientId, scheduleEntryId: scheduleId, date: fmt(new Date()), status: 'enrolled', subscriptionId: null, isSingleVisit: false, price: 0 }]
    }));
  };

  const markVisit = (visitId: string, status: 'attended' | 'missed' | 'cancelled', subscriptionId: string | null, isSingleVisit: boolean, singlePrice: number) => {
    update(s => {
      let newSubs = s.subscriptions;
      if (status === 'attended' && subscriptionId) {
        newSubs = s.subscriptions.map(sub => {
          if (sub.id !== subscriptionId) return sub;
          // Если абонемент pending — активируем его: пересчитываем endDate от сегодня
          if (sub.status === 'pending') {
            const plan = s.subscriptionPlans.find(p => p.id === sub.planId);
            const durationDays = plan?.durationDays ?? 30;
            const activatedAt = fmt(new Date());
            const endDate = fmt(addDays(new Date(), durationDays));
            const updatedSub = { ...sub, status: 'active' as const, activatedAt, endDate, autoActivateDate: null };
            if (updatedSub.sessionsLeft === 'unlimited') return updatedSub;
            return { ...updatedSub, sessionsLeft: (updatedSub.sessionsLeft as number) - 1 };
          }
          if (sub.sessionsLeft === 'unlimited') return sub;
          return { ...sub, sessionsLeft: (sub.sessionsLeft as number) - 1 };
        });
      }
      return {
        ...s,
        visits: s.visits.map(v => v.id === visitId ? { ...v, status, subscriptionId, isSingleVisit, price: isSingleVisit ? singlePrice : 0 } : v),
        subscriptions: newSubs
      };
    });
  };

  // Автоматически активировать pending абонементы у которых истёк срок ожидания
  const autoActivatePendingSubscriptions = () => {
    const todayStr = fmt(new Date());
    update(s => ({
      ...s,
      subscriptions: s.subscriptions.map(sub => {
        if (sub.status !== 'pending' || !sub.autoActivateDate) return sub;
        if (sub.autoActivateDate <= todayStr) {
          // Активируем: endDate = autoActivateDate + durationDays
          const plan = s.subscriptionPlans.find(p => p.id === sub.planId);
          const durationDays = plan?.durationDays ?? 30;
          const activatedAt = sub.autoActivateDate;
          const endDate = fmt(addDays(new Date(activatedAt), durationDays));
          return { ...sub, status: 'active' as const, activatedAt, endDate, autoActivateDate: null };
        }
        return sub;
      })
    }));
  };

  const copyWeekSchedule = (fromDays: string[], toDays: string[]) => {
    update(s => {
      const fromEntries = s.schedule.filter(e => fromDays.includes(e.date) && e.branchId === s.currentBranchId);
      const newEntries = fromEntries.map(e => {
        const dayIndex = fromDays.indexOf(e.date);
        return {
          ...e,
          id: genId(),
          date: toDays[dayIndex] || e.date,
          enrolledClientIds: [],
        };
      });
      return { ...s, schedule: [...s.schedule, ...newEntries] };
    });
  };

  const resetVisit = (visitId: string) => {
    update(s => {
      const visit = s.visits.find(v => v.id === visitId);
      if (!visit || visit.status !== 'attended') return s;
      let newSubs = s.subscriptions;
      if (visit.subscriptionId) {
        newSubs = s.subscriptions.map(sub => {
          if (sub.id !== visit.subscriptionId || sub.sessionsLeft === 'unlimited') return sub;
          return { ...sub, sessionsLeft: (sub.sessionsLeft as number) + 1 };
        });
      }
      return {
        ...s,
        visits: s.visits.map(v => v.id === visitId ? { ...v, status: 'enrolled', subscriptionId: null, isSingleVisit: false, price: 0 } : v),
        subscriptions: newSubs
      };
    });
  };

  // Добавить клиента из другого филиала в текущий (копия с новым branchId)
  const addClientToBranch = (clientId: string, targetBranchId: string) => {
    update(s => {
      const client = s.clients.find(c => c.id === clientId);
      if (!client) return s;
      const alreadyInBranch = s.clients.some(c => c.id === clientId && c.branchId === targetBranchId);
      if (alreadyInBranch) return s;
      const newClient: Client = { ...client, id: genId(), branchId: targetBranchId, fromBranchId: client.branchId, createdAt: fmt(new Date()), activeSubscriptionId: null };
      return { ...s, clients: [...s.clients, newClient] };
    });
  };

  // Inquiries
  const addInquiry = (inquiry: Omit<Inquiry, 'id'>) => {
    update(s => ({ ...s, inquiries: [...s.inquiries, { ...inquiry, id: genId() }] }));
  };

  const addContactChannel = (channel: string) => {
    update(s => ({ ...s, contactChannels: [...s.contactChannels, channel] }));
  };
  const updateContactChannel = (oldVal: string, newVal: string) => {
    update(s => ({ ...s, contactChannels: s.contactChannels.map(c => c === oldVal ? newVal : c) }));
  };
  const removeContactChannel = (val: string) => {
    update(s => ({ ...s, contactChannels: s.contactChannels.filter(c => c !== val) }));
  };

  const addAdSource = (source: string) => {
    update(s => ({ ...s, adSources: [...s.adSources, source] }));
  };
  const updateAdSource = (oldVal: string, newVal: string) => {
    update(s => ({ ...s, adSources: s.adSources.map(a => a === oldVal ? newVal : a) }));
  };
  const removeAdSource = (val: string) => {
    update(s => ({ ...s, adSources: s.adSources.filter(a => a !== val) }));
  };

  // Expenses
  const addExpense = (expense: Omit<Expense, 'id'>) => {
    update(s => ({ ...s, expenses: [...s.expenses, { ...expense, id: genId() }] }));
  };

  const updateExpense = (id: string, data: Partial<Expense>) => {
    update(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, ...data } : e) }));
  };

  const deleteExpense = (id: string) => {
    update(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) }));
  };

  const addExpenseCategory = (category: Omit<ExpenseCategory, 'id'>) => {
    update(s => ({ ...s, expenseCategories: [...s.expenseCategories, { ...category, id: genId() }] }));
  };

  // Expense Plans (план расходов по категориям)
  const setExpensePlan = (branchId: string, month: string, categoryId: string, planAmount: number) => {
    update(s => {
      const existing = s.expensePlans.find(p => p.branchId === branchId && p.month === month && p.categoryId === categoryId);
      if (existing) {
        return { ...s, expensePlans: s.expensePlans.map(p => p.branchId === branchId && p.month === month && p.categoryId === categoryId ? { ...p, planAmount } : p) };
      }
      return { ...s, expensePlans: [...s.expensePlans, { id: genId(), branchId, month, categoryId, planAmount }] };
    });
  };

  // Monthly Plans (план/факт)
  const setMonthlyPlan = (branchId: string, month: string, plan: Partial<MonthlyPlanRow>) => {
    update(s => {
      const existing = s.monthlyPlans.find(p => p.branchId === branchId && p.month === month);
      if (existing) {
        return { ...s, monthlyPlans: s.monthlyPlans.map(p => p.branchId === branchId && p.month === month ? { ...p, plan } : p) };
      }
      return { ...s, monthlyPlans: [...s.monthlyPlans, { id: genId(), branchId, month, plan }] };
    });
  };

  // Sales Plans
  const setSalesPlan = (branchId: string, month: string, items: SalesPlanItem[]) => {
    update(s => {
      const existing = s.salesPlans.find(p => p.branchId === branchId && p.month === month);
      if (existing) {
        return { ...s, salesPlans: s.salesPlans.map(p => p.branchId === branchId && p.month === month ? { ...p, items } : p) };
      }
      return { ...s, salesPlans: [...s.salesPlans, { id: genId(), branchId, month, items }] };
    });
  };
  const updateExpenseCategory = (id: string, data: Partial<ExpenseCategory>) => {
    update(s => ({ ...s, expenseCategories: s.expenseCategories.map(c => c.id === id ? { ...c, ...data } : c) }));
  };
  const removeExpenseCategory = (id: string) => {
    update(s => ({ ...s, expenseCategories: s.expenseCategories.filter(c => c.id !== id) }));
  };

  // Notifications
  const dismissNotification = (key: string) => {
    update(s => ({ ...s, dismissedNotifications: [...s.dismissedNotifications.filter(k => k !== key), key] }));
  };
  const restoreNotification = (key: string) => {
    update(s => {
      const { [key]: _, ...rest } = s.failedNotifications;
      return { ...s, dismissedNotifications: s.dismissedNotifications.filter(k => k !== key), failedNotifications: rest };
    });
  };
  const failNotification = (key: string, reason: string) => {
    update(s => ({
      ...s,
      dismissedNotifications: [...s.dismissedNotifications.filter(k => k !== key), key],
      failedNotifications: { ...s.failedNotifications, [key]: reason },
    }));
  };
  const addNotificationCategory = (cat: Omit<NotificationCategory, 'id'>) => {
    update(s => ({ ...s, notificationCategories: [...s.notificationCategories, { ...cat, id: genId() }] }));
  };
  const updateNotificationCategory = (id: string, data: Partial<NotificationCategory>) => {
    update(s => ({ ...s, notificationCategories: s.notificationCategories.map(c => c.id === id ? { ...c, ...data } : c) }));
  };
  const removeNotificationCategory = (id: string) => {
    update(s => ({ ...s, notificationCategories: s.notificationCategories.filter(c => c.id !== id) }));
  };

  // Branches & Settings
  const addBranch = (branch: Omit<Branch, 'id'>) => {
    update(s => ({ ...s, branches: [...s.branches, { ...branch, id: genId() }] }));
  };
  const updateBranch = (id: string, data: Partial<Branch>) => {
    update(s => ({ ...s, branches: s.branches.map(b => b.id === id ? { ...b, ...data } : b) }));
  };
  const removeBranch = (id: string) => {
    update(s => ({ ...s, branches: s.branches.filter(b => b.id !== id) }));
  };

  const addHall = (hall: Omit<Hall, 'id'>) => {
    update(s => ({ ...s, halls: [...s.halls, { ...hall, id: genId() }] }));
  };
  const updateHall = (id: string, data: Partial<Hall>) => {
    update(s => ({ ...s, halls: s.halls.map(h => h.id === id ? { ...h, ...data } : h) }));
  };
  const removeHall = (id: string) => {
    update(s => ({ ...s, halls: s.halls.filter(h => h.id !== id) }));
  };

  const addTrainer = (trainer: Omit<Trainer, 'id'>) => {
    update(s => ({ ...s, trainers: [...s.trainers, { ...trainer, id: genId() }] }));
  };
  const updateTrainer = (id: string, data: Partial<Trainer>) => {
    update(s => ({ ...s, trainers: s.trainers.map(t => t.id === id ? { ...t, ...data } : t) }));
  };
  const removeTrainer = (id: string) => {
    update(s => ({ ...s, trainers: s.trainers.filter(t => t.id !== id) }));
  };

  const addTrainingCategory = (cat: Omit<TrainingCategory, 'id'>) => {
    update(s => ({ ...s, trainingCategories: [...s.trainingCategories, { ...cat, id: genId() }] }));
  };
  const updateTrainingCategory = (id: string, data: Partial<TrainingCategory>) => {
    update(s => ({ ...s, trainingCategories: s.trainingCategories.map(c => c.id === id ? { ...c, ...data } : c) }));
  };
  const removeTrainingCategory = (id: string) => {
    update(s => ({ ...s, trainingCategories: s.trainingCategories.filter(c => c.id !== id) }));
  };

  const addTrainingType = (tt: Omit<TrainingType, 'id'>) => {
    update(s => ({ ...s, trainingTypes: [...s.trainingTypes, { ...tt, id: genId() }] }));
  };
  const updateTrainingType = (id: string, data: Partial<TrainingType>) => {
    update(s => ({ ...s, trainingTypes: s.trainingTypes.map(t => t.id === id ? { ...t, ...data } : t) }));
  };
  const removeTrainingType = (id: string) => {
    update(s => ({ ...s, trainingTypes: s.trainingTypes.filter(t => t.id !== id) }));
  };

  const addSubscriptionPlan = (plan: Omit<SubscriptionPlan, 'id'>) => {
    update(s => ({ ...s, subscriptionPlans: [...s.subscriptionPlans, { ...plan, id: genId() }] }));
  };
  const updateSubscriptionPlan = (id: string, data: Partial<SubscriptionPlan>) => {
    update(s => ({ ...s, subscriptionPlans: s.subscriptionPlans.map(p => p.id === id ? { ...p, ...data } : p) }));
  };
  const removeSubscriptionPlan = (id: string) => {
    update(s => ({ ...s, subscriptionPlans: s.subscriptionPlans.filter(p => p.id !== id) }));
  };

  const addSingleVisitPlan = (plan: Omit<SingleVisitPlan, 'id'>) => {
    update(s => ({ ...s, singleVisitPlans: [...s.singleVisitPlans, { ...plan, id: genId() }] }));
  };
  const updateSingleVisitPlan = (id: string, data: Partial<SingleVisitPlan>) => {
    update(s => ({ ...s, singleVisitPlans: s.singleVisitPlans.map(p => p.id === id ? { ...p, ...data } : p) }));
  };
  const removeSingleVisitPlan = (id: string) => {
    update(s => ({ ...s, singleVisitPlans: s.singleVisitPlans.filter(p => p.id !== id) }));
  };

  const setCurrentBranch = (branchId: string) => {
    update(s => ({ ...s, currentBranchId: branchId }));
  };

  // Staff management
  const addStaff = (member: Omit<StaffMember, 'id' | 'createdAt'>) => {
    update(s => ({ ...s, staff: [...s.staff, { ...member, id: genId(), createdAt: fmt(new Date()) }] }));
  };
  const updateStaff = (id: string, data: Partial<StaffMember>) => {
    update(s => ({ ...s, staff: s.staff.map(m => m.id === id ? { ...m, ...data } : m) }));
  };
  const removeStaff = (id: string) => {
    update(s => ({ ...s, staff: s.staff.filter(m => m.id !== id) }));
  };
  const setCurrentStaff = (staffId: string) => {
    update(s => ({ ...s, currentStaffId: staffId }));
  };
  const generateInviteToken = (staffId: string) => {
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    update(s => ({ ...s, staff: s.staff.map(m => m.id === staffId ? { ...m, inviteToken: token } : m) }));
    return token;
  };

  // Helpers
  const getClientCategory = (client: Client): ClientCategory => {
    if (client.importedStatus && !client.activeSubscriptionId && !state.sales.some(s => s.clientId === client.id && s.type === 'subscription')) {
      return client.importedStatus;
    }
    const hasSub = !!client.activeSubscriptionId;
    const allSubs = state.sales.filter(s => s.clientId === client.id && s.type === 'subscription');
    if (allSubs.length === 0) return 'new';
    if (hasSub) return 'loyal';
    const lastSale = allSubs.sort((a, b) => b.date.localeCompare(a.date))[0];
    const daysSince = (Date.now() - new Date(lastSale.date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 90) return 'sleeping';
    return 'lost';
  };

  const getClientFullName = (client: Client) => `${client.lastName} ${client.firstName} ${client.middleName}`.trim();

  const findClientByPhone = (phone: string) => state.clients.find(c => c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));

  return {
    state,
    dbLoaded,
    addClient, updateClient, addClientToBranch,
    sellSubscription, sellSingleVisit, sellExtra,
    freezeSubscription, unfreezeSubscription, returnSubscription, updateSubscription,
    addScheduleEntry, updateScheduleEntry, removeScheduleEntry, enrollClient, markVisit, resetVisit, copyWeekSchedule,
    autoActivatePendingSubscriptions,
    addBranch, updateBranch, removeBranch,
    addHall, updateHall, removeHall,
    addTrainer, updateTrainer, removeTrainer,
    addTrainingCategory, updateTrainingCategory, removeTrainingCategory,
    addTrainingType, updateTrainingType, removeTrainingType,
    addSubscriptionPlan, updateSubscriptionPlan, removeSubscriptionPlan,
    addSingleVisitPlan, updateSingleVisitPlan, removeSingleVisitPlan,
    addStaff, updateStaff, removeStaff, setCurrentStaff, generateInviteToken,
    addInquiry,
    addContactChannel, updateContactChannel, removeContactChannel,
    addAdSource, updateAdSource, removeAdSource,
    addExpense, updateExpense, deleteExpense, addExpenseCategory, updateExpenseCategory, removeExpenseCategory,
    setSalesPlan, setMonthlyPlan, setExpensePlan,
    setCurrentBranch,
    getClientCategory, getClientFullName, findClientByPhone,
    dismissNotification, restoreNotification, failNotification,
    addNotificationCategory, updateNotificationCategory, removeNotificationCategory,
  };
}

export type StoreType = ReturnType<typeof useStore>;