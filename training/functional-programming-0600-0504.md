# 函数式编程专项训练 v10 — 实战模式与工程化

> 日期: 2026-05-04 06:00
> 前置: 基础(4/23) → 巩固(4/24) → 进阶(4/26) → 实战(4/27) → 示例(4/28) → 示例集(4/29) → 核心(4/30) → 高级(5/2) → 巩固(5/3)
> 本次主题: **FP 工程化实战** — 验证管道 / 状态机 / 解析器 / 查询构建 / 策略组合 / 契约测试
> 目标: 12+ 全新示例，覆盖真实工程场景，无重复

---

## 一、纯函数 — 验证管道 (Validation Pipeline)

### 示例 1: 类型安全的表单验证管道

```typescript
// 验证结果类型
type ValidationResult = { valid: true } | { valid: false; errors: string[] };

// 纯验证函数 — 每个只做一件事
const required = (field: string) => (value: any): ValidationResult =>
  value !== undefined && value !== null && value !== ''
    ? { valid: true }
    : { valid: false, errors: [`${field} is required`] };

const minLength = (min: number) => (field: string) => (value: string): ValidationResult =>
  typeof value === 'string' && value.length >= min
    ? { valid: true }
    : { valid: false, errors: [`${field} must be at least ${min} characters`] };

const maxLength = (max: number) => (field: string) => (value: string): ValidationResult =>
  typeof value === 'string' && value.length <= max
    ? { valid: true }
    : { valid: false, errors: [`${field} must be at most ${max} characters`] };

const pattern = (regex: RegExp, message: string) => (field: string) => (value: string): ValidationResult =>
  typeof value === 'string' && regex.test(value)
    ? { valid: true }
    : { valid: false, errors: [`${field}: ${message}`] };

const isEmail = pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'invalid email format');
const isPhone = pattern(/^1[3-9]\d{9}$/, 'invalid phone number');

// 组合验证器 — 纯函数组合
const combineValidators = <T>(
  field: keyof T,
  ...validators: Array<(value: any) => ValidationResult>
): ((obj: T) => ValidationResult) => (obj: T): ValidationResult => {
  const results = validators.map(v => v(obj[field]));
  const errors = results.flatMap(r => r.valid ? [] : r.errors);
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};

// 整体验证管道
const validateForm = <T extends Record<string, any>>(
  rules: Record<keyof T, Array<(value: any) => ValidationResult>>
) => (data: T): ValidationResult => {
  const allErrors = Object.entries(rules).flatMap(([field, validators]) => {
    const results = validators.map(v => v(data[field]));
    return results.flatMap(r => r.valid ? [] : r.errors.map(e => `[${field}] ${e}`));
  });
  return allErrors.length === 0
    ? { valid: true }
    : { valid: false, errors: allErrors };
};

// 使用
const userRules = {
  name: [required('name'), minLength(2)('name'), maxLength(50)('name')],
  email: [required('email'), isEmail('email')],
  phone: [required('phone'), isPhone('phone')],
};

const validateUser = validateForm(userRules);

validateUser({ name: 'Jack', email: 'jack@example.com', phone: '13800138000' });
// { valid: true }

validateUser({ name: '', email: 'bad', phone: '123' });
// { valid: false, errors: [
//   '[name] name is required',
//   '[email] email: invalid email format',
//   '[phone] phone: invalid phone number'
// ]}
```

### 示例 2: 验证器组合子 (Combinators)

```typescript
// 验证器组合子 — 高阶纯函数
const allPass = <T>(...validators: Array<(x: T) => ValidationResult>) =>
  (x: T): ValidationResult => {
    const errors = validators.flatMap(v => {
      const r = v(x);
      return r.valid ? [] : r.errors;
    });
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  };

const anyPass = <T>(...validators: Array<(x: T) => ValidationResult>) =>
  (x: T): ValidationResult =>
    validators.some(v => v(x).valid)
      ? { valid: true }
      : { valid: false, errors: ['No validator passed'] };

const not = <T>(validator: (x: T) => ValidationResult) =>
  (x: T): ValidationResult => {
    const r = validator(x);
    return r.valid
      ? { valid: false, errors: ['Validation should have failed'] }
      : { valid: true };
  };

const mapErrors = (transform: (e: string) => string) => (result: ValidationResult): ValidationResult =>
  result.valid ? result : { valid: false, errors: result.errors.map(transform) };

// 使用组合子
const strongPassword = allPass(
  minLength(8)('password'),
  pattern(/[A-Z]/, 'must contain uppercase')('password'),
  pattern(/[0-9]/, 'must contain digit')('password'),
  pattern(/[^A-Za-z0-9]/, 'must contain special char')('password'),
);

const nonDefaultUsername = not(required('username'));

// 管道化错误处理
const validateAndFormat = (data: any) =>
  pipe(
    validateUser,
    mapErrors(e => e.toUpperCase()),
  )(data);
```

---

## 二、不可变性 — 不可变状态机

### 示例 3: 不可变有限状态机 (FSM)

```typescript
// 不可变状态机 — 所有状态转换返回新状态
type FSM<S, E extends string> = {
  state: S;
  transitions: Record<string, Record<E, S | null>>;
  actions: Record<string, (prev: any, event: any) => any>;
};

const createFSM = <S extends string, E extends string>(
  initialState: S,
  transitions: Record<S, Partial<Record<E, S>>>,
  actions: Record<S, (payload?: any) => any> = {}
): FSM<S, E> => ({
  state: initialState,
  transitions: transitions as any,
  actions,
});

// 纯状态转换 — 不修改原状态
const transition = <S extends string, E extends string>(
  fsm: FSM<S, E>,
  event: E,
  payload?: any
): { fsm: FSM<S, E>; changed: boolean } => {
  const nextState = fsm.transitions[fsm.state]?.[event];
  if (!nextState) {
    return { fsm, changed: false }; // 无效转换，返回原状态（不可变）
  }
  const action = fsm.actions[nextState];
  const newState: FSM<S, E> = {
    ...fsm,
    state: nextState,
    ...(action ? { actions: { ...fsm.actions, [nextState]: action } } : {}),
  };
  return { fsm: newState, changed: true };
};

// 使用：订单状态机
type OrderState = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
type OrderEvent = 'PAY' | 'SHIP' | 'DELIVER' | 'CANCEL' | 'RETURN';

const orderMachine = createFSM<OrderState, OrderEvent>('pending', {
  pending: { PAY: 'paid', CANCEL: 'cancelled' },
  paid: { SHIP: 'shipped', CANCEL: 'cancelled' },
  shipped: { DELIVER: 'delivered' },
  delivered: { RETURN: 'pending' },
  cancelled: {},
});

// 状态转换链（纯函数，每次返回新机器）
let machine = orderMachine;

const result1 = transition(machine, 'PAY');
machine = result1.fsm; // machine.state = 'paid'

const result2 = transition(machine, 'SHIP');
machine = result2.fsm; // machine.state = 'shipped'

const result3 = transition(machine, 'CANCEL'); // 无效转换
// result3.changed = false, machine.state 仍为 'shipped'

// 状态历史追踪（不可变）
const createStateHistory = <S extends string, E extends string>() => {
  const history: Array<{ state: S; event: E; timestamp: number }> = [];
  return {
    record: (state: S, event: E): typeof history => {
      const entry = { state, event, timestamp: Date.now() };
      return [...history, entry]; // 返回新数组
    },
    getHistory: () => [...history],
    undo: (currentHistory: typeof history): typeof history =>
      currentHistory.slice(0, -1),
  };
};
```

### 示例 4: 不可变树操作

```typescript
// 不可变树 — 所有操作返回新树
type Tree<T> = {
  value: T;
  children: Tree<T>[];
};

// 纯函数：在树中查找
const findInTree = <T>(predicate: (node: Tree<T>) => boolean) =>
  (tree: Tree<T>): Tree<T> | null => {
    if (predicate(tree)) return tree;
    for (const child of tree.children) {
      const found = findInTree(predicate)(child);
      if (found) return found;
    }
    return null;
  };

// 纯函数：更新树中节点（返回新树，路径上所有节点都是新的）
const updateInTree = <T>(
  predicate: (node: Tree<T>) => boolean,
  updater: (node: Tree<T>) => T
) => (tree: Tree<T>): Tree<T> => {
  if (predicate(tree)) {
    return { ...tree, value: updater(tree) };
  }
  return {
    ...tree,
    children: tree.children.map(child => updateInTree(predicate, updater)(child)),
  };
};

// 纯函数：删除节点
const deleteFromTree = <T>(
  predicate: (node: Tree<T>) => boolean
) => (tree: Tree<T>): Tree<T> | null => {
  if (predicate(tree)) return null;
  const newChildren = tree.children
    .map(child => deleteFromTree(predicate)(child))
    .filter(Boolean) as Tree<T>[];
  return { ...tree, children: newChildren };
};

// 纯函数：路径查询
const pathTo = <T>(predicate: (node: Tree<T>) => boolean) =>
  (tree: Tree<T>): T[] => {
    if (predicate(tree)) return [tree.value];
    for (const child of tree.children) {
      const path = pathTo(predicate)(child);
      if (path.length > 0) return [tree.value, ...path];
    }
    return [];
  };

// 使用
const orgTree: Tree<string> = {
  value: 'CEO',
  children: [
    {
      value: 'CTO',
      children: [
        { value: 'Frontend Lead', children: [] },
        { value: 'Backend Lead', children: [] },
      ],
    },
    {
      value: 'CFO',
      children: [
        { value: 'Accounting', children: [] },
      ],
    },
  ],
};

// 查找
findInTree(n => n.value === 'CTO')(orgTree); // { value: 'CTO', children: [...] }

// 更新（不可变）
const updated = updateInTree(
  n => n.value === 'CTO',
  n => ({ ...n, value: 'Chief Technology Officer' } as any)
)(orgTree);
// orgTree 不变，updated 是新树

// 路径查询
pathTo(n => n.value === 'Frontend Lead')(orgTree); // ['CEO', 'CTO', 'Frontend Lead']
```

---

## 三、函数组合 — 查询构建器

### 示例 5: 不可变查询构建器 (QueryBuilder)

```typescript
// 查询构建器 — 纯函数组合，每次返回新查询
type Query = {
  table: string;
  where: Array<(row: Record<string, any>) => boolean>;
  orderBy: Array<{ key: string; desc: boolean }>;
  limit: number | null;
  offset: number;
  select: string[] | null;
};

const createQuery = (table: string): Query => ({
  table,
  where: [],
  orderBy: [],
  limit: null,
  offset: 0,
  select: null,
});

// 纯函数：添加 WHERE 条件
const where = (predicate: (row: Record<string, any>) => boolean) =>
  (query: Query): Query => ({
    ...query,
    where: [...query.where, predicate],
  });

// 便捷 where 构建器
const eq = (key: string, value: any) =>
  where(row => row[key] === value);

const gt = (key: string, value: any) =>
  where(row => row[key] > value);

const lt = (key: string, value: any) =>
  where(row => row[key] < value);

const inList = (key: string, values: any[]) =>
  where(row => values.includes(row[key]));

const between = (key: string, min: any, max: any) =>
  where(row => row[key] >= min && row[key] <= max);

// 纯函数：排序
const orderBy = (key: string, desc = false) =>
  (query: Query): Query => ({
    ...query,
    orderBy: [...query.orderBy, { key, desc }],
  });

// 纯函数：限制
const limit = (n: number) =>
  (query: Query): Query => ({ ...query, limit: n });

const offset = (n: number) =>
  (query: Query): Query => ({ ...query, offset: n });

// 纯函数：选择字段
const select = (...fields: string[]) =>
  (query: Query): Query => ({ ...query, select: fields });

// 纯函数：执行查询
const executeQuery = (data: Record<string, any>[]) =>
  (query: Query): Record<string, any>[] => {
    let result = data.filter(row => query.where.every(pred => pred(row)));

    // 排序
    if (query.orderBy.length > 0) {
      result = [...result].sort((a, b) => {
        for (const { key, desc } of query.orderBy) {
          if (a[key] < b[key]) return desc ? 1 : -1;
          if (a[key] > b[key]) return desc ? -1 : 1;
        }
        return 0;
      });
    }

    // 分页
    if (query.offset > 0) result = result.slice(query.offset);
    if (query.limit !== null) result = result.slice(0, query.limit);

    // 字段选择
    if (query.select) {
      result = result.map(row =>
        Object.fromEntries(query.select!.map(f => [f, row[f]]))
      );
    }

    return result;
  };

// 管道化查询构建
const pipeQuery = <T extends Query>(...fns: Array<(q: T) => T>) =>
  (query: T): T => fns.reduce((q, fn) => fn(q), query);

// 使用
const users = [
  { id: 1, name: 'Alice', age: 28, city: 'Beijing', role: 'admin' },
  { id: 2, name: 'Bob', age: 22, city: 'Shanghai', role: 'user' },
  { id: 3, name: 'Charlie', age: 35, city: 'Beijing', role: 'user' },
  { id: 4, name: 'Diana', age: 30, city: 'Guangzhou', role: 'admin' },
];

const query = pipeQuery(
  createQuery('users'),
  eq('city', 'Beijing'),
  gt('age', 25),
  orderBy('age', true),
  select('name', 'age', 'role'),
);

const result = executeQuery(users)(query);
// [{ name: 'Charlie', age: 35, role: 'user' }, { name: 'Alice', age: 28, role: 'admin' }]
```

### 示例 6: CSS 样式构建器

```typescript
// 不可变样式构建器 — 纯函数组合
type CSSProperties = Record<string, string | number>;

const createStyles = (): CSSProperties => ({});

// 纯函数：添加样式
const withColor = (color: string) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, color });

const withBg = (bg: string) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, backgroundColor: bg });

const withFontSize = (size: number) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, fontSize: `${size}px` });

const withPadding = (value: number) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, padding: `${value}px` });

const withMargin = (value: number) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, margin: `${value}px` });

const withBorder = (width: number, style: string, color: string) =>
  (styles: CSSProperties): CSSProperties =>
    ({ ...styles, border: `${width}px ${style} ${color}` });

const withRadius = (radius: number) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, borderRadius: `${radius}px` });

const withDisplay = (display: string) => (styles: CSSProperties): CSSProperties =>
  ({ ...styles, display });

const withFlex = (direction: string, align: string, justify: string) =>
  (styles: CSSProperties): CSSProperties =>
    ({
      ...styles,
      display: 'flex',
      flexDirection: direction,
      alignItems: align,
      justifyContent: justify,
    });

const withTransition = (property: string, duration: number, easing: string) =>
  (styles: CSSProperties): CSSProperties =>
    ({ ...styles, transition: `${property} ${duration}ms ${easing}` });

const withShadow = (h: number, v: number, blur: number, color: string) =>
  (styles: CSSProperties): CSSProperties =>
    ({ ...styles, boxShadow: `${h}px ${v}px ${blur}px ${color}` });

// 预设主题 — 纯函数组合
const cardStyle = pipe(
  createStyles,
  withPadding(16),
  withRadius(8),
  withShadow(0, 2, 8, 'rgba(0,0,0,0.1)'),
  withBg('#ffffff'),
);

const buttonStyle = pipe(
  createStyles,
  withPadding(12),
  withRadius(4),
  withBg('#1890ff'),
  withColor('#ffffff'),
  withTransition('all', 200, 'ease'),
  withFlex('row', 'center', 'center'),
);

// 组合主题
const primaryCard = pipe(
  cardStyle,
  withBorder(2, 'solid', '#1890ff'),
);

const dangerCard = pipe(
  cardStyle,
  withBorder(2, 'solid', '#ff4d4f'),
  withBg('#fff2f0'),
);
```

---

## 四、柯里化 — 策略模式

### 示例 7: 柯里化策略工厂

```typescript
// 策略工厂 — 柯里化创建策略
type Strategy<T, R> = (input: T) => R;

// 柯里化策略创建器
const createStrategy = <C, T, R>(
  config: C,
  executor: (config: C) => (input: T) => R
): Strategy<T, R> => executor(config);

// 折扣策略工厂
const discountStrategy = (type: 'percentage' | 'fixed' | 'tiered', value: number) =>
  (amount: number): number => {
    switch (type) {
      case 'percentage':
        return amount * (1 - value / 100);
      case 'fixed':
        return Math.max(0, amount - value);
      case 'tiered':
        return amount > value ? amount * 0.85 : amount;
      default:
        return amount;
    }
  };

// 使用柯里化创建具体策略
const tenPercentOff = createStrategy(['percentage', 10] as const, ([type, value]) => discountStrategy(type, value));
const fiftyOff = createStrategy(['fixed', 50] as const, ([type, value]) => discountStrategy(type, value));
const bulkDiscount = createStrategy(['tiered', 1000] as const, ([type, value]) => discountStrategy(type, value));

tenPercentOff(100); // 90
fiftyOff(100); // 50
bulkDiscount(1200); // 1020
bulkDiscount(800); // 800

// 柯里化中间件链
type Middleware<T> = (ctx: T, next: () => T) => T;

const createMiddleware = <T>(
  pre: (ctx: T) => T,
  post: (ctx: T) => T
): Middleware<T> => (ctx: T, next: () => T): T => post(next(pre(ctx)));

// 具体中间件
const withLogging = <T>(label: string): Middleware<T> =>
  createMiddleware(
    ctx => { console.log(`[${label}] before`, ctx); return ctx; },
    ctx => { console.log(`[${label}] after`, ctx); return ctx; }
  );

const withTiming = <T>(label: string): Middleware<T> =>
  createMiddleware(
    ctx => { (ctx as any).__start = Date.now(); return ctx; },
    ctx => {
      const elapsed = Date.now() - (ctx as any).__start;
      console.log(`[${label}] took ${elapsed}ms`);
      return ctx;
    }
  );

const withValidation = <T>(validator: (ctx: T) => boolean, errorMsg: string): Middleware<T> =>
  createMiddleware(
    ctx => {
      if (!validator(ctx)) throw new Error(errorMsg);
      return ctx;
    },
    ctx => ctx
  );

// 中间件管道
const applyMiddleware = <T>(middlewares: Middleware<T>[], initial: T): T => {
  let idx = 0;
  const next = (): T =>
    idx < middlewares.length
      ? middlewares[idx++](initial, next)
      : initial;
  return next();
};
```

### 示例 8: 柯里化模板引擎

```typescript
// 柯里化模板引擎 — 纯函数模板组合
type TemplateVars = Record<string, string | number>;

// 基础模板函数
const template = (str: string) => (vars: TemplateVars): string =>
  str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));

// 柯里化模板工厂
const createTemplate = (base: string) => {
  const render = template(base);
  return {
    render,
    // 柯里化：预设部分变量
    with: (partialVars: TemplateVars) =>
      (remainingVars: TemplateVars): string =>
        render({ ...partialVars, ...remainingVars }),
    // 柯里化：组合模板
    and: (other: ReturnType<typeof createTemplate>) =>
      createTemplate(base + '\n' + other.toString()),
  };
};

// 使用
const header = createTemplate('<header>{{title}}</header>');
const body = createTemplate('<main>{{content}}</main>');
const footer = createTemplate('<footer>{{copyright}}</footer>');

// 预设变量
const siteHeader = header.with({ title: 'My Site' });
siteHeader({}); // '<header>My Site</header>'

// 完整渲染
const page = createTemplate('{{header}}\n{{body}}\n{{footer}}');
page.render({
  header: header.render({ title: 'Dashboard' }),
  body: body.render({ content: 'Welcome!' }),
  footer: footer.render({ copyright: '© 2026' }),
});

// 柯里化链式模板
const emailTemplate = createTemplate(
  'Hi {{name}},\n\n{{message}}\n\nBest,\n{{sender}}'
);

const welcomeEmail = emailTemplate.with({ sender: 'The Team' });
welcomeEmail({ name: 'Jack', message: 'Welcome aboard!' });
// 'Hi Jack,\n\nWelcome aboard!\n\nBest,\nThe Team'
```

---

## 五、不可变性 + 组合 — 事件溯源

### 示例 9: 不可变事件溯源系统

```typescript
// 事件溯源 — 纯函数 + 不可变性
type Event = {
  type: string;
  payload: any;
  timestamp: number;
  version: number;
};

type EventSourcedState<S> = {
  state: S;
  events: Event[];
  version: number;
};

// 纯函数：应用事件到状态
const applyEvent = <S>(
  reducer: (state: S, event: Event) => S
) => (esState: EventSourcedState<S>, event: Event): EventSourcedState<S> => {
  const newState = reducer(esState.state, event);
  const newEvent: Event = {
    ...event,
    version: esState.version + 1,
    timestamp: Date.now(),
  };
  return {
    state: newState,
    events: [...esState.events, newEvent],
    version: esState.version + 1,
  };
};

// 纯函数：重放事件
const replayEvents = <S>(
  reducer: (state: S, event: Event) => S,
  initialState: S,
  events: Event[]
): S =>
  events.reduce((state, event) => reducer(state, event), initialState);

// 纯函数：快照
const snapshot = <S>(esState: EventSourcedState<S>) => ({
  state: { ...esState.state },
  version: esState.version,
  eventCount: esState.events.length,
});

// 纯函数：增量事件
const getNewEvents = (fromVersion: number) =>
  <S>(esState: EventSourcedState<S>): Event[] =>
    esState.events.filter(e => e.version > fromVersion);

// 使用：购物车事件溯源
type CartItem = { id: string; name: string; price: number; qty: number };
type CartState = { items: CartItem[]; total: number };

const cartReducer = (state: CartState, event: Event): CartState => {
  switch (event.type) {
    case 'ITEM_ADDED': {
      const existing = state.items.find(i => i.id === event.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.id === event.payload.id
              ? { ...i, qty: i.qty + event.payload.qty }
              : i
          ),
          total: state.total + event.payload.price * event.payload.qty,
        };
      }
      return {
        ...state,
        items: [...state.items, { ...event.payload, qty: event.payload.qty }],
        total: state.total + event.payload.price * event.payload.qty,
      };
    }
    case 'ITEM_REMOVED':
      const removed = state.items.find(i => i.id === event.payload.id);
      return {
        ...state,
        items: state.items.filter(i => i.id !== event.payload.id),
        total: state.total - (removed?.price ?? 0) * (removed?.qty ?? 0),
      };
    case 'ITEM_QTY_CHANGED': {
      const item = state.items.find(i => i.id === event.payload.id);
      const diff = (event.payload.qty ?? 0) - (item?.qty ?? 0);
      return {
        ...state,
        items: state.items.map(i =>
          i.id === event.payload.id ? { ...i, qty: event.payload.qty } : i
        ),
        total: state.total + (item?.price ?? 0) * diff,
      };
    }
    default:
      return state;
  }
};

const initialCart: EventSourcedState<CartState> = {
  state: { items: [], total: 0 },
  events: [],
  version: 0,
};

// 事件流
let cart = initialCart;
cart = applyEvent(cartReducer)(cart, { type: 'ITEM_ADDED', payload: { id: 'a', name: 'Book', price: 29.9, qty: 1 } });
cart = applyEvent(cartReducer)(cart, { type: 'ITEM_ADDED', payload: { id: 'b', name: 'Pen', price: 5.5, qty: 2 } });
cart = applyEvent(cartReducer)(cart, { type: 'ITEM_QTY_CHANGED', payload: { id: 'a', qty: 3 } });

// cart.state = { items: [...], total: 100.7 }
// cart.events = [3 events]
// cart.version = 3

// 重放（从快照恢复）
const restored = replayEvents(cartReducer, { items: [], total: 0 }, cart.events);
// restored === cart.state (引用不同，值相同)
```

---

## 六、组合 + 柯里化 — 数据转换管道

### 示例 10: ETL 数据转换管道

```typescript
// ETL 管道 — 纯函数组合
type Row = Record<string, any>;

// 提取 (Extract) — 纯函数
const extract = <T>(source: T[]) => ({
  // 转换 (Transform)
  transform: <R>(fn: (row: T) => R) => extract(fn(source)),
  filter: (predicate: (row: T) => boolean) => extract(source.filter(predicate)),
  map: <R>(fn: (row: T) => R) => extract(fn(source)),
  flatMap: <R>(fn: (row: T) => R[]) =>
    extract(source.flatMap(fn)),
  groupBy: <K extends string>(key: (row: T) => string) =>
    extract(
      Object.entries(
        source.reduce((groups, row) => {
          const k = key(row);
          return { ...groups, [k]: [...(groups[k] ?? []), row] };
        }, {} as Record<string, T[]>)
      ).map(([k, v]) => ({ [key]: k, count: v.length, items: v }))
    ),
  sort: (comparator: (a: T, b: T) => number) => extract([...source].sort(comparator)),
  limit: (n: number) => extract(source.slice(0, n)),
  // 加载 (Load)
  load: () => source,
  count: () => source.length,
  toArray: () => source,
});

// 使用
const salesData = [
  { region: 'East', product: 'A', amount: 1200, month: 'Jan' },
  { region: 'West', product: 'B', amount: 800, month: 'Jan' },
  { region: 'East', product: 'B', amount: 1500, month: 'Feb' },
  { region: 'West', product: 'A', amount: 900, month: 'Feb' },
  { region: 'East', product: 'A', amount: 1100, month: 'Mar' },
];

// 管道化 ETL
const result = extract(salesData)
  .filter(row => row.amount > 1000)
  .map(row => ({ ...row, tax: row.amount * 0.1 }))
  .sort((a, b) => b.amount - a.amount)
  .load();

// 分组聚合
const byRegion = extract(salesData)
  .groupBy(row => row.region)
  .load();

// 组合管道 — 纯函数
const pipeline = <T>(...steps: Array<(input: T[]) => T[]>) =>
  (data: T[]): T[] => steps.reduce((acc, step) => step(acc), data);

const highValuePipeline = pipeline(
  (rows: Row[]) => rows.filter(r => r.amount > 1000),
  (rows: Row[]) => rows.map(r => ({ ...r, net: r.amount * 0.9 })),
  (rows: Row[]) => [...rows].sort((a, b) => b.net - a.net),
);

highValuePipeline(salesData);
```

### 示例 11: 不可变路由匹配器

```typescript
// 不可变路由匹配 — 纯函数组合
type Route = {
  pattern: string;
  handler: (params: Record<string, string>) => any;
  middleware: Array<(params: Record<string, string>) => Record<string, string>>;
};

type Router = {
  routes: Route[];
  defaultHandler: () => any;
};

// 纯函数：创建路由器
const createRouter = (): Router => ({
  routes: [],
  defaultHandler: () => ({ error: 'Not Found', status: 404 }),
});

// 纯函数：添加路由
const addRoute = (pattern: string, handler: (params: Record<string, string>) => any) =>
  (router: Router): Router => ({
    ...router,
    routes: [...router.routes, { pattern, handler, middleware: [] }],
  });

// 纯函数：添加中间件到路由
const withMiddleware = (
  pattern: string,
  middleware: (params: Record<string, string>) => Record<string, string>
) => (router: Router): Router => ({
  ...router,
  routes: router.routes.map(r =>
    r.pattern === pattern
      ? { ...r, middleware: [...r.middleware, middleware] }
      : r
  ),
});

// 纯函数：解析路径参数
const parseParams = (pattern: string, path: string): Record<string, string> | null => {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const key = patternParts[i].slice(1);
      params[key] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
};

// 纯函数：匹配路由
const matchRoute = (path: string) => (router: Router): { handler: (params: Record<string, string>) => any; params: Record<string, string> } | null => {
  for (const route of router.routes) {
    const params = parseParams(route.pattern, path);
    if (params) {
      // 应用中间件链
      const finalParams = route.middleware.reduce(
        (p, mw) => mw(p),
        params
      );
      return { handler: route.handler, params: finalParams };
    }
  }
  return null;
};

// 纯函数：路由处理
const handleRequest = (path: string) => (router: Router): any => {
  const match = matchRoute(path)(router);
  return match ? match.handler(match.params) : router.defaultHandler();
};

// 使用
const router = pipe(
  createRouter,
  addRoute('/users/:id', params => ({ user: params.id })),
  addRoute('/posts/:postId/comments/:commentId', params => ({
    post: params.postId,
    comment: params.commentId,
  })),
  withMiddleware('/users/:id', params => ({
    ...params,
    id: String(Number(params.id)), // 规范化
  })),
);

handleRequest('/users/42')(router); // { user: '42' }
handleRequest('/posts/1/comments/5')(router); // { post: '1', comment: '5' }
handleRequest('/unknown')(router); // { error: 'Not Found', status: 404 }
```

---

## 七、综合实战 — FP 配置系统

### 示例 12: 不可变配置管理系统

```typescript
// 不可变配置系统 — 纯函数 + 柯里化 + 组合
type Config = Record<string, any>;

// 纯函数：创建配置
const createConfig = (defaults: Config): Config => ({ ...defaults });

// 纯函数：获取配置值（支持嵌套路径）
const get = (path: string) => (config: Config): any =>
  path.split('.').reduce((obj, key) => obj?.[key], config);

// 纯函数：设置配置值（不可变，返回新配置）
const set = (path: string, value: any) => (config: Config): Config => {
  const keys = path.split('.');
  const setDeep = (obj: any, keys: string[], value: any): any => {
    if (keys.length === 1) return { ...obj, [keys[0]]: value };
    return {
      ...obj,
      [keys[0]]: setDeep(obj[keys[0]] ?? {}, keys.slice(1), value),
    };
  };
  return setDeep(config, keys, value);
};

// 纯函数：删除配置值
const unset = (path: string) => (config: Config): Config => {
  const keys = path.split('.');
  const unsetDeep = (obj: any, keys: string[]): any => {
    if (keys.length === 1) {
      const { [keys[0]]: _, ...rest } = obj;
      return rest;
    }
    return { ...obj, [keys[0]]: unsetDeep(obj[keys[0]], keys.slice(1)) };
  };
  return unsetDeep(config, keys);
};

// 纯函数：合并配置
const merge = (override: Config) => (base: Config): Config => {
  const mergeDeep = (a: any, b: any): any => {
    if (typeof a !== 'object' || typeof b !== 'object') return b;
    if (a === null || b === null) return b;
    if (Array.isArray(a) || Array.isArray(b)) return b;
    const result = { ...a };
    for (const key of Object.keys(b)) {
      result[key] = mergeDeep(a[key], b[key]);
    }
    return result;
  };
  return mergeDeep(base, override);
};

// 纯函数：配置验证
const validate = (schema: Record<string, (value: any) => boolean>) =>
  (config: Config): { valid: boolean; errors: string[] } => {
    const errors = Object.entries(schema).flatMap(([path, validator]) => {
      const value = get(path)(config);
      return validator(value) ? [] : [`Invalid config: ${path}`];
    });
    return { valid: errors.length === 0, errors };
  };

// 纯函数：配置管道
const configPipe = (...steps: Array<(config: Config) => Config>) =>
  (config: Config): Config => steps.reduce((c, step) => step(c), config);

// 纯函数：环境变量注入（柯里化）
const withEnv = (prefix: string) => (config: Config): Config => {
  const envConfig: Config = {};
  for (const [key, value] of Object.entries(process?.env ?? {})) {
    if (key.startsWith(prefix)) {
      const configKey = key.slice(prefix.length + 1).toLowerCase();
      envConfig[configKey] = value;
    }
  }
  return merge(envConfig)(config);
};

// 纯函数：默认值回退（柯里化）
const withDefaults = (defaults: Config) => (config: Config): Config => {
  const fillDefaults = (target: any, source: any): any => {
    const result = { ...source };
    for (const key of Object.keys(source)) {
      if (target[key] === undefined) {
        result[key] = source[key];
      } else if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = fillDefaults(target[key], source[key]);
      }
    }
    return result;
  };
  return fillDefaults(config, defaults);
};

// 使用
const baseConfig = createConfig({
  server: { port: 3000, host: 'localhost' },
  db: { host: 'localhost', port: 5432, name: 'myapp' },
  cache: { ttl: 3600, enabled: true },
});

// 配置管道
const appConfig = configPipe(
  set('server.port', 8080),
  set('db.host', 'db.example.com'),
  set('cache.ttl', 7200),
  merge({ logging: { level: 'info', format: 'json' } }),
  unset('cache.enabled'),
)(baseConfig);

// 验证
const schema = {
  'server.port': (v: number) => v > 0 && v < 65536,
  'db.host': (v: string) => typeof v === 'string' && v.length > 0,
  'db.name': (v: string) => typeof v === 'string' && v.length > 0,
};

validate(schema)(appConfig); // { valid: true, errors: [] }

// 柯里化：环境配置
const prodConfig = configPipe(
  withEnv('MYAPP'), // 假设 MYAPP_DB_HOST=db.prod.com
  set('server.port', 443),
  set('db.host', 'db.prod.example.com'),
)(baseConfig);
```

---

## 八、总结 — 10 大 FP 工程模式

| # | 模式 | 核心 FP 概念 | 应用场景 |
|---|------|-------------|---------|
| 1 | 验证管道 | 纯函数 + 组合 | 表单验证、数据校验 |
| 2 | 验证组合子 | 高阶函数 + 柯里化 | 复杂验证规则组合 |
| 3 | 不可变状态机 | 不可变性 + 纯函数 | 订单流程、UI 状态 |
| 4 | 不可变树操作 | 不可变性 + 递归 | 目录树、组织架构 |
| 5 | 查询构建器 | 纯函数 + 组合 | 数据查询、过滤排序 |
| 6 | CSS 样式构建器 | 柯里化 + 组合 | 主题系统、样式工厂 |
| 7 | 策略工厂 | 柯里化 + 高阶函数 | 折扣、计费、规则引擎 |
| 8 | 模板引擎 | 柯里化 + 组合 | 邮件、消息模板 |
| 9 | 事件溯源 | 不可变性 + 纯函数 | 购物车、审计日志 |
| 10 | ETL 管道 | 纯函数 + 组合 | 数据处理、报表 |
| 11 | 路由匹配 | 纯函数 + 不可变性 | API 路由、页面路由 |
| 12 | 配置系统 | 不可变性 + 柯里化 + 组合 | 应用配置、环境管理 |

### FP 核心收益

1. **可测试性**: 纯函数 = 100% 可单元测试，无需 mock
2. **可组合性**: 小函数 → 大功能，乐高式构建
3. **可预测性**: 相同输入 → 相同输出，无隐藏状态
4. **并发安全**: 不可变数据 → 无竞态条件
5. **调试友好**: 管道可中断、可重放、可回溯
