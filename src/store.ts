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
  notificationCategories: NotificationCategory[];
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
  notificationCategories: DEFAULT_NOTIFICATION_CATEGORIES,
};

const STORAGE_KEY = 'fitcrm_state_v1';
const AUTH_KEY = 'fitcrm_auth_v1';

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
      return {
        ...initialState,
        ...parsed,
        subscriptions,
        subscriptionPlans,
        singleVisitPlans,
        trainers,
        trainingTypes,
        dismissedNotifications: parsed.dismissedNotifications ?? [],
        notificationCategories: parsed.notificationCategories ?? DEFAULT_NOTIFICATION_CATEGORIES,
      };
    }
  } catch (e) { /* ignore */ }
  return initialState;
}

function saveState(s: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
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
    update(s => ({ ...s, dismissedNotifications: s.dismissedNotifications.filter(k => k !== key) }));
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

  // Helpers
  const getClientCategory = (client: Client): ClientCategory => {
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
    addClient, updateClient, addClientToBranch,
    sellSubscription, sellSingleVisit, sellExtra,
    freezeSubscription, returnSubscription, updateSubscription,
    addScheduleEntry, updateScheduleEntry, removeScheduleEntry, enrollClient, markVisit, resetVisit, copyWeekSchedule,
    autoActivatePendingSubscriptions,
    addBranch, updateBranch, removeBranch,
    addHall, updateHall, removeHall,
    addTrainer, updateTrainer, removeTrainer,
    addTrainingCategory, updateTrainingCategory, removeTrainingCategory,
    addTrainingType, updateTrainingType, removeTrainingType,
    addSubscriptionPlan, updateSubscriptionPlan, removeSubscriptionPlan,
    addSingleVisitPlan, updateSingleVisitPlan, removeSingleVisitPlan,
    addStaff, updateStaff, removeStaff, setCurrentStaff,
    addInquiry,
    addContactChannel, updateContactChannel, removeContactChannel,
    addAdSource, updateAdSource, removeAdSource,
    addExpense, updateExpense, deleteExpense, addExpenseCategory, updateExpenseCategory, removeExpenseCategory,
    setSalesPlan, setMonthlyPlan, setExpensePlan,
    setCurrentBranch,
    getClientCategory, getClientFullName, findClientByPhone,
    dismissNotification, restoreNotification,
    addNotificationCategory, updateNotificationCategory, removeNotificationCategory,
  };
}

export type StoreType = ReturnType<typeof useStore>;