# 🏗️ 前端架构设计专项训练 — MVC / MVVM / 微前端

**时间：** 2026-04-28 18:00  
**主题：** 前端架构模式深度解析 + 完整应用架构设计  
**前置：** 组件设计进阶 + 状态管理 + 网络层 + 构建工具  
**本次：** 三大架构模式手写实现 + 架构决策框架 + 完整应用架构设计

---

## 一、架构模式全景图

### 1.1 为什么需要架构模式？

```
没有架构的应用 = 一锅粥
├── 所有逻辑混在组件里
├── 数据流向不可追踪
├── 测试困难 (无法隔离)
├── 重构 = 重写
└── 新人上手 = 噩梦

有架构的应用 = 乐高积木
├── 职责清晰，边界明确
├── 数据流向可预测
├── 可独立测试每个模块
├── 渐进式重构
└── 新人 1 天理解整体结构
```

### 1.2 前端架构模式演进

```
1990s    2000s      2010s       2015s       2020s
  │        │          │           │           │
  │        │          │           │           │
jQuery    Backbone   AngularJS   React       Micro-FE
纯DOM     MVC        MVVM        Flux        Module Federation
操作      (首次引入   (双向绑定    (单向数据    (应用级拆分)
         架构概念)    普及)       流革命)
                                    │
                              Vue (MVVM + 组合式)
                              Svelte (编译时)
                              Solid (细粒度响应)
```

### 1.3 核心模式对比

| 模式 | 数据流向 | 核心思想 | 代表框架 | 复杂度 | 适用场景 |
|------|---------|---------|---------|--------|---------|
| **MVC** | 单向 (C→M→V) | 控制器协调模型和视图 | Backbone, jQuery Plugins | ★★☆ | 中小型应用、渐进增强 |
| **MVVM** | 双向绑定 | ViewModel 自动同步 M↔V | Vue, Knockout | ★★☆ | 中大型应用、表单密集 |
| **Flux/Redux** | 单向数据流 | 唯一 Store + 不可变更新 | React+Redux, Vuex | ★★★ | 大型应用、复杂状态 |
| **Clean Architecture** | 依赖倒置 | 业务逻辑独立于 UI 框架 | 自研 | ★★★★ | 企业级、长期维护 |
| **微前端** | 多应用路由 | 应用级拆分、独立部署 | qiankun, Module Federation | ★★★★★ | 超大型、多团队协作 |

---

## 二、MVC 模式 — 手写实现

### 2.1 MVC 核心概念

```
┌─────────────┐
│  Controller  │ ← 用户交互入口，协调 Model 和 View
└──────┬──────┘
       │ 更新数据
       ▼
┌─────────────┐      通知变化
│   Model     │ ──────────────→
│  (数据层)    │              │
└─────────────┘              │
       ▲                     ▼
       │ 读取数据      ┌─────────────┐
└──────┴──────────────│    View     │
                      │  (展示层)    │
                      └─────────────┘
```

**核心原则：**
- **Model** — 纯数据 + 业务逻辑，不依赖 View
- **View** — 纯展示，不直接修改 Model
- **Controller** — 唯一桥梁，处理用户输入 → 更新 Model → 刷新 View

### 2.2 手写 Mini MVC 框架

```typescript
// ===== Model 层 =====
interface ModelOptions<T> {
  data: T;
  validators?: Partial<Record<keyof T, (value: any) => string | null>>;
  onDirty?: (changedKeys: (keyof T)[]) => void;
}

class Model<T extends Record<string, any>> {
  private _data: T;
  private _original: T;
  private _validators: Partial<Record<keyof T, (value: any) => string | null>>;
  private _listeners: Array<(changedKeys: (keyof T)[]) => void> = [];

  constructor(options: ModelOptions<T>) {
    this._data = { ...options.data };
    this._original = JSON.parse(JSON.stringify(options.data));
    this._validators = options.validators || {};
    if (options.onDirty) {
      this._listeners.push(options.onDirty);
    }
  }

  // 读取属性
  get<K extends keyof T>(key: K): T[K] {
    return this._data[key];
  }

  // 设置属性（带验证）
  set<K extends keyof T>(key: K, value: T[K]): this {
    const validator = this._validators[key];
    if (validator) {
      const error = validator(value);
      if (error) throw new Error(`Validation failed for ${String(key)}: ${error}`);
    }

    const oldValue = this._data[key];
    if (oldValue === value) return this; // 无变化，跳过

    this._data[key] = value;
    this._notify([key]);
    return this;
  }

  // 批量设置
  setAll(patch: Partial<T>): this {
    const changedKeys: (keyof T)[] = [];
    for (const [key, value] of Object.entries(patch)) {
      const k = key as keyof T;
      const validator = this._validators[k];
      if (validator) {
        const error = validator(value);
        if (error) throw new Error(`Validation failed for ${String(k)}: ${error}`);
      }
      if (this._data[k] !== value) {
        (this._data as any)[k] = value;
        changedKeys.push(k);
      }
    }
    if (changedKeys.length > 0) this._notify(changedKeys);
    return this;
  }

  // 订阅变化
  onChange(fn: (changedKeys: (keyof T)[]) => void): () => void {
    this._listeners.push(fn);
    return () => {
      const idx = this._listeners.indexOf(fn);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  // 验证整个 Model
  validate(): Record<string, string> | null {
    const errors: Record<string, string> = {};
    for (const [key, validator] of Object.entries(this._validators)) {
      const error = validator!(this._data[key as keyof T]);
      if (error) errors[key] = error;
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }

  // 重置到初始状态
  reset(): this {
    this._data = JSON.parse(JSON.stringify(this._original));
    this._notify(Object.keys(this._data) as (keyof T)[]);
    return this;
  }

  // 获取脏字段
  getDirtyKeys(): (keyof T)[] {
    return (Object.keys(this._data) as (keyof T)[]).filter(
      (k) => this._data[k] !== this._original[k]
    );
  }

  // 标记为已保存（同步 original）
  markSaved(): this {
    this._original = JSON.parse(JSON.stringify(this._data));
    return this;
  }

  // 导出纯数据
  toJSON(): T {
    return { ...this._data };
  }

  private _notify(changedKeys: (keyof T)[]): void {
    for (const fn of this._listeners) {
      fn(changedKeys);
    }
  }
}

// ===== View 层 =====
type RenderFn<T> = (model: Model<T>, container: HTMLElement) => void;

class View<T extends Record<string, any>> {
  private model: Model<T>;
  private container: HTMLElement;
  private renderFn: RenderFn<T>;
  private unbind: (() => void) | null = null;

  constructor(model: Model<T>, container: HTMLElement, renderFn: RenderFn<T>) {
    this.model = model;
    this.container = container;
    this.renderFn = renderFn;
    this.bind();
  }

  private bind(): void {
    this.unbind = this.model.onChange(() => this.render());
    this.render();
  }

  private render(): void {
    this.renderFn(this.model, this.container);
  }

  destroy(): void {
    if (this.unbind) this.unbind();
  }
}

// ===== Controller 层 =====
type EventHandler = (event: Event) => void;

class Controller<T extends Record<string, any>> {
  private model: Model<T>;
  private view: View<T>;
  private handlers: Map<string, EventHandler> = new Map();

  constructor(model: Model<T>, view: View<T>) {
    this.model = model;
    this.view = view;
  }

  // 绑定事件处理器
  on(selector: string, eventType: string, handler: EventHandler): this {
    const key = `${eventType}:${selector}`;
    this.handlers.set(key, handler);

    // 事件委托
    this.view['container'].addEventListener(eventType, (e: Event) => {
      const target = e.target as Element;
      if (target.closest(selector)) {
        handler.call(this, e);
      }
    });
    return this;
  }

  getModel(): Model<T> {
    return this.model;
  }

  destroy(): void {
    this.view.destroy();
    this.handlers.clear();
  }
}

// ===== 完整示例：Todo MVC =====
interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TodoModelData {
  todos: TodoItem[];
  filter: 'all' | 'active' | 'completed';
  nextId: number;
}

// 1. 创建 Model
const todoModel = new Model<TodoModelData>({
  data: {
    todos: [],
    filter: 'all',
    nextId: 1,
  },
  validators: {
    filter: (v) =>
      ['all', 'active', 'completed'].includes(v) ? null : 'Invalid filter',
  },
});

// 2. 创建 View
const todoRender: RenderFn<TodoModelData> = (model, container) => {
  const { todos, filter } = model.toJSON();
  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;

  container.innerHTML = `
    <div class="todo-mvc">
      <h2>Todo MVC (${activeCount} remaining)</h2>
      <div class="input-row">
        <input type="text" class="todo-input" placeholder="Add a todo..." />
        <button class="todo-add-btn">Add</button>
      </div>
      <ul class="todo-list">
        ${filtered
          .map(
            (t) => `
          <li class="todo-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
            <input type="checkbox" class="todo-check" ${t.completed ? 'checked' : ''} />
            <span class="todo-text">${t.text}</span>
            <button class="todo-delete">✕</button>
          </li>
        `
          )
          .join('')}
      </ul>
      <div class="filters">
        <button class="filter-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-btn ${filter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
        <button class="filter-btn ${filter === 'completed' ? 'active' : ''}" data-filter="completed">Completed</button>
      </div>
    </div>
  `;
};

// 3. 创建 Controller
const container = document.getElementById('app')!;
const view = new View(todoModel, container, todoRender);
const controller = new Controller(todoModel, view);

// 添加 Todo
controller.on('.todo-add-btn', 'click', () => {
  const input = container.querySelector('.todo-input') as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;

  const model = controller.getModel();
  const { todos, nextId } = model.toJSON();
  model.setAll({
    todos: [...todos, { id: nextId, text, completed: false, createdAt: Date.now() }],
    nextId: nextId + 1,
  });
  input.value = '';
});

// 切换完成状态
controller.on('.todo-check', 'change', (e) => {
  const item = (e.target as Element).closest('.todo-item')!;
  const id = Number(item.dataset.id);
  const model = controller.getModel();
  const { todos } = model.toJSON();
  model.set(
    'todos',
    todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
  );
});

// 删除 Todo
controller.on('.todo-delete', 'click', (e) => {
  const item = (e.target as Element).closest('.todo-item')!;
  const id = Number(item.dataset.id);
  const model = controller.getModel();
  const { todos } = model.toJSON();
  model.set('todos', todos.filter((t) => t.id !== id));
});

// 筛选
controller.on('.filter-btn', 'click', (e) => {
  const filter = (e.target as Element).dataset.filter as 'all' | 'active' | 'completed';
  if (filter) controller.getModel().set('filter', filter);
});
```

### 2.3 MVC 的局限

```
MVC 的问题：
├── Controller 容易变成"上帝对象"
├── Model 和 View 的绑定是手动的（容易漏掉）
├── 复杂表单场景下，手动同步太繁琐
└── 没有内置的"状态快照"和"时间旅行"

→ 这就是 MVVM 和 Flux 要解决的问题
```

---

## 三、MVVM 模式 — 手写实现

### 3.1 MVVM 核心概念

```
┌─────────────┐         ┌─────────────┐
│    View     │ ◄─────► │  ViewModel  │
│  (模板/DOM)  │  双向绑定  │  (状态+逻辑) │
└─────────────┘         └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Model     │
                        │  (纯数据)    │
                        └─────────────┘
```

**核心思想：** ViewModel 是 View 的"数据模型"，View 通过声明式模板绑定到 ViewModel，数据变化自动反映到 DOM。

### 3.2 手写 Mini MVVM 框架（响应式核心）

```typescript
// ===== 响应式引擎 =====
type DepCallback = () => void;

class Dep {
  private subscribers = new Set<DepCallback>();

  depend(fn?: DepCallback): void {
    if (fn) this.subscribers.add(fn);
  }

  notify(): void {
    for (const fn of this.subscribers) {
      fn();
    }
  }

  size(): number {
    return this.subscribers.size;
  }
}

// 全局活跃 effect
let activeEffect: DepCallback | null = null;

// 响应式 Proxy
function reactive<T extends Record<string, any>>(target: T): T {
  const deps = new Map<string | symbol, Dep>();

  return new Proxy(target, {
    get(obj, key) {
      const dep = deps.get(key);
      if (dep && activeEffect) {
        dep.depend(activeEffect);
      }
      const value = obj[key];
      // 嵌套对象也变成响应式
      if (value && typeof value === 'object') {
        return reactive(value);
      }
      return value;
    },
    set(obj, key, value) {
      const oldValue = obj[key];
      if (oldValue === value) return true;
      obj[key] = value;
      let dep = deps.get(key);
      if (!dep) {
        dep = new Dep();
        deps.set(key, dep);
      }
      dep.notify();
      return true;
    },
  });
}

// Computed 计算属性
function computed<T>(getter: () => T): { value: T } {
  let cachedValue: T;
  let dirty = true;
  const dep = new Dep();

  const runner: DepCallback = () => {
    dirty = true;
    dep.notify();
  };

  return {
    get value() {
      if (dirty) {
        activeEffect = runner;
        cachedValue = getter();
        activeEffect = null;
        dirty = false;
      }
      dep.depend(activeEffect || undefined);
      return cachedValue;
    },
  };
}

// Watch 侦听器
function watch(getter: () => any, callback: (newVal: any, oldVal: any) => void): () => void {
  let oldValue = getter();
  const effect: DepCallback = () => {
    const newValue = getter();
    if (newValue !== oldValue) {
      callback(newValue, oldValue);
      oldValue = newValue;
    }
  };
  activeEffect = effect;
  getter(); // 首次执行建立依赖
  activeEffect = null;
  return () => {}; // cleanup
}

// ===== 模板编译引擎 =====
class Compiler {
  private vm: any;

  constructor(el: string | HTMLElement, vm: any) {
    this.vm = vm;
    const container = typeof el === 'string' ? document.querySelector(el)! : el;
    this.compile(container);
  }

  private compile(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      this.compileElement(node as Element);
    }
    if (node.nodeType === Node.TEXT_NODE) {
      this.compileText(node);
    }
    // 递归子节点
    node.childNodes.forEach((child) => this.compile(child));
  }

  private compileElement(el: Element): void {
    // v-model 双向绑定
    if (el.hasAttribute('v-model')) {
      const key = el.getAttribute('v-model')!;
      const updateFn = this.createUpdater(el, key);

      // 初始渲染
      const value = this.getVmValue(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        (el as HTMLInputElement).value = value ?? '';
      }

      // 用户输入 → 更新 ViewModel
      el.addEventListener('input', () => {
        const newVal = (el as HTMLInputElement).value;
        this.setVmValue(key, newVal);
      });

      // ViewModel 变化 → 更新 DOM
      activeEffect = updateFn;
      this.getVmValue(key); // 建立依赖
      activeEffect = null;
    }

    // v-text
    if (el.hasAttribute('v-text')) {
      const key = el.getAttribute('v-text')!;
      const updateFn = this.createUpdater(el, key);
      el.textContent = String(this.getVmValue(key));
      activeEffect = updateFn;
      this.getVmValue(key);
      activeEffect = null;
    }

    // v-if
    if (el.hasAttribute('v-if')) {
      const key = el.getAttribute('v-if')!;
      const parent = el.parentNode!;
      const comment = document.createComment('v-if');
      parent.replaceChild(comment, el);

      const updateFn = () => {
        const val = !!this.getVmValue(key);
        if (val && !comment.parentNode) {
          parent.insertBefore(el, comment);
        } else if (!val && el.parentNode) {
          parent.replaceChild(comment, el);
        }
      };

      updateFn();
      activeEffect = updateFn;
      this.getVmValue(key);
      activeEffect = null;
    }

    // v-for
    if (el.hasAttribute('v-for')) {
      const forExpr = el.getAttribute('v-for')!;
      // 解析 "item in items" 或 "(item, index) in items"
      const match = forExpr.match(
        /^(?:\((\w+),?\s*(\w*)\)|(\w+))\s+in\s+(\w+)$/
      );
      if (match) {
        const itemKey = match[1] || match[3]!;
        const indexKey = match[2];
        const listKey = match[4]!;
        const parent = el.parentNode!;
        const template = el.cloneNode(true);
        const comment = document.createComment('v-for');
        parent.replaceChild(comment, el);

        const updateFn = () => {
          const list = this.getVmValue(listKey) || [];
          // 清除旧节点
          let next = comment.nextSibling;
          while (next && next.nodeType !== Node.COMMENT_NODE) {
            const toRemove = next;
            next = next.nextSibling;
            parent.removeChild(toRemove);
          }
          // 渲染新节点
          list.forEach((item: any, idx: number) => {
            const clone = template.cloneNode(true) as Element;
            this.compileForNode(clone, itemKey, item, indexKey, idx);
            parent.insertBefore(clone, comment);
          });
        };

        updateFn();
        activeEffect = updateFn;
        this.getVmValue(listKey);
        activeEffect = null;
      }
    }

    // v-on:click / @click
    el.getAttributeNames().forEach((attr) => {
      if (attr.startsWith('v-on:') || attr.startsWith('@')) {
        const eventType = attr.includes(':')
          ? attr.split(':')[1]
          : attr.slice(1);
        const methodName = el.getAttribute(attr)!;
        el.addEventListener(eventType, (e) => {
          this.vm[methodName](e);
        });
        el.removeAttribute(attr);
      }
    });

    // :class / v-bind:class
    if (el.hasAttribute(':class') || el.hasAttribute('v-bind:class')) {
      const attr = el.hasAttribute(':class') ? ':class' : 'v-bind:class';
      const expr = el.getAttribute(attr)!;
      const updateFn = () => {
        const classVal = this.evalExpr(expr);
        if (typeof classVal === 'string') {
          el.className = classVal;
        } else if (Array.isArray(classVal)) {
          el.className = classVal.filter(Boolean).join(' ');
        } else if (typeof classVal === 'object') {
          el.className = Object.entries(classVal)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(' ');
        }
      };
      updateFn();
      activeEffect = updateFn;
      // 解析表达式中的依赖
      this.extractDeps(expr);
      activeEffect = null;
      el.removeAttribute(attr);
    }
  }

  private compileForNode(
    el: Element,
    itemKey: string,
    item: any,
    indexKey: string | undefined,
    idx: number
  ): void {
    // 替换模板中的 {{itemKey.xxx}}
    const replaceInNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const regex = new RegExp(`\\{\\{\\s*${itemKey}\\.([\\w.]+)\\s*\\}\\}`, 'g');
        node.textContent = node.textContent!.replace(regex, (_, path) => {
          return this.getNestedValue(item, path);
        });
        // 替换 index
        if (indexKey) {
          const idxRegex = new RegExp(`\\{\\{\\s*${indexKey}\\s*\\}\\}`, 'g');
          node.textContent = node.textContent!.replace(idxRegex, String(idx));
        }
      }
      node.childNodes.forEach(replaceInNode);
    };
    replaceInNode(el);
  }

  private compileText(node: Node): void {
    const text = node.textContent!;
    const regex = /\{\{\s*(.+?)\s*\}\}/g;
    if (!regex.test(text)) return;

    const parent = node.parentNode!;
    const spans: SpanData[] = [];
    let lastIndex = 0;
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        spans.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      spans.push({ type: 'expr', expr: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      spans.push({ type: 'text', content: text.slice(lastIndex) });
    }

    // 替换为 span 元素
    const wrapper = document.createElement('span');
    spans.forEach((s) => {
      if (s.type === 'text') {
        wrapper.appendChild(document.createTextNode(s.content));
      } else {
        const span = document.createElement('span');
        const updateFn = () => {
          span.textContent = String(this.evalExpr(s.expr));
        };
        updateFn();
        activeEffect = updateFn;
        this.extractDeps(s.expr);
        activeEffect = null;
        wrapper.appendChild(span);
      }
    });

    parent.replaceChild(wrapper, node);
  }

  private createUpdater(el: Element, key: string): DepCallback {
    return () => {
      const value = this.getVmValue(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if ((el as HTMLInputElement).value !== String(value ?? '')) {
          (el as HTMLInputElement).value = value ?? '';
        }
      } else {
        el.textContent = String(value);
      }
    };
  }

  private getVmValue(key: string): any {
    return this.getNestedValue(this.vm, key);
  }

  private setVmValue(key: string, value: any): void {
    const parts = key.split('.');
    let obj: any = this.vm;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  private evalExpr(expr: string): any {
    // 简单表达式求值（支持 vm 属性访问）
    try {
      const vm = this.vm;
      return new Function(
        ...Object.keys(vm),
        `return ${expr}`
      )(...Object.values(vm));
    } catch {
      return '';
    }
  }

  private extractDeps(expr: string): void {
    // 简单提取依赖（提取标识符）
    const ids = expr.match(/[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*/g) || [];
    ids.forEach((id) => {
      if (id in this.vm) {
        this.getVmValue(id); // 触发 getter 建立依赖
      }
    });
  }
}

interface SpanData {
  type: 'text' | 'expr';
  content?: string;
  expr?: string;
}

// ===== 完整示例：Todo MVVM =====
class TodoApp {
  todos = reactive<TodoItem[]>([]);
  newTodo = '';
  filter: 'all' | 'active' | 'completed' = 'active';
  nextId = 1;

  // 计算属性
  get filteredTodos(): TodoItem[] {
    return this.todos.filter((t) => {
      if (this.filter === 'active') return !t.completed;
      if (this.filter === 'completed') return t.completed;
      return true;
    });
  }

  get remaining(): number {
    return this.todos.filter((t) => !t.completed).length;
  }

  get total(): number {
    return this.todos.length;
  }

  // 方法
  addTodo(): void {
    const text = this.newTodo.trim();
    if (!text) return;
    this.todos.push({
      id: this.nextId++,
      text,
      completed: false,
      createdAt: Date.now(),
    });
    this.newTodo = '';
  }

  toggleTodo(id: number): void {
    const idx = this.todos.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.todos[idx].completed = !this.todos[idx].completed;
    }
  }

  removeTodo(id: number): void {
    const idx = this.todos.findIndex((t) => t.id === id);
    if (idx >= 0) this.todos.splice(idx, 1);
  }

  clearCompleted(): void {
    const idx = this.todos.findIndex((t) => t.completed);
    if (idx >= 0) {
      this.todos.splice(idx, 1);
      this.clearCompleted(); // 递归清理
    }
  }
}

// 挂载
const app = new TodoApp();
new Compiler('#app', app);

// 模板示例：
// <input v-model="newTodo" @keyup.enter="addTodo" placeholder="Add a todo..." />
// <button @click="addTodo">Add</button>
// <ul>
//   <li v-for="todo in todos">
//     <input type="checkbox" v-if="todo.completed" />
//     <span v-text="todo.text"></span>
//     <button @click="removeTodo(todo.id)">✕</button>
//   </li>
// </ul>
// <p>{{ remaining }} remaining / {{ total }} total</p>
```

### 3.3 MVVM vs MVC 对比

```
┌──────────────┬──────────────────┬──────────────────┐
│   维度       │     MVC          │     MVVM         │
├──────────────┼──────────────────┼──────────────────┤
│ 数据同步     │ 手动 (C 调用)     │ 自动 (响应式)     │
│ 模板语法     │ 无 (JS 拼接)      │ 声明式 ({{}})    │
│ 学习曲线     │ 低               │ 中               │
│ 表单处理     │ 繁琐              │ 简洁 (v-model)   │
│ 测试性       │ Controller 难测   │ ViewModel 易测   │
│ 适用场景     │ 简单页面          │ 表单密集型应用   │
└──────────────┴──────────────────┴──────────────────┘
```

---

## 四、Flux/Redux 模式 — 手写实现

### 4.1 单向数据流

```
┌────────┐    dispatch(action)    ┌──────────┐
│ View   │ ────────────────────→  │ Dispatcher│
│ (React)│                        └─────┬────┘
└────────┘                              │
   ▲                                    ▼
   │                              ┌──────────┐
   │    subscribe(state)          │  Store   │
   │                              └─────┬────┘
   │                                    │
   └────────────────────────────────────┘
         (state → render)
```

### 4.2 Mini Redux 实现

```typescript
// ===== 核心类型 =====
type Action = { type: string; payload?: any };
type Reducer<S> = (state: S, action: Action) => S;
type Listener = () => void;

interface MiddlewareApi<S> {
  getState: () => S;
  dispatch: (action: Action) => Action;
}

type Middleware<S> = (api: MiddlewareApi<S>) => (next: Dispatch) => Dispatch;
type Dispatch = (action: Action) => Action;

// ===== Store =====
class Store<S> {
  private state: S;
  private reducer: Reducer<S>;
  private listeners: Set<Listener> = new Set();
  private dispatch: Dispatch;

  constructor(reducer: Reducer<S>, initialState: S) {
    this.state = initialState;
    this.reducer = reducer;

    // 默认 dispatch
    this.dispatch = (action: Action): Action => {
      this.state = this.reducer(this.state, action);
      this.listeners.forEach((fn) => fn());
      return action;
    };
  }

  getState(): S {
    return this.state;
  }

  dispatch(action: Action): Action {
    return this.dispatch(action);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // 应用中间件
  use(middleware: Middleware<S>): this {
    const api: MiddlewareApi<S> = {
      getState: () => this.state,
      dispatch: (action: Action) => this.dispatch(action),
    };
    this.dispatch = middleware(api)(this.dispatch);
    return this;
  }
}

// ===== 中间件 =====

// Logger 中间件
const loggerMiddleware: Middleware<any> = (api) => (next) => (action) => {
  console.group(`🔵 Action: ${action.type}`);
  console.log('  prev:', api.getState());
  const result = next(action);
  console.log('  next:', api.getState());
  console.groupEnd();
  return result;
};

// Thunk 中间件（异步 Action）
type ThunkAction<S> = (dispatch: Dispatch, getState: () => S) => void;

const thunkMiddleware: Middleware<any> = (api) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(api.dispatch, api.getState);
  }
  return next(action);
};

// ===== 完整示例：Todo Redux =====
interface TodoState {
  todos: TodoItem[];
  filter: 'all' | 'active' | 'completed';
  loading: boolean;
  error: string | null;
}

const initialState: TodoState = {
  todos: [],
  filter: 'all',
  loading: false,
  error: null,
};

type TodoAction =
  | { type: 'ADD_TODO'; payload: { text: string } }
  | { type: 'TOGGLE_TODO'; payload: { id: number } }
  | { type: 'DELETE_TODO'; payload: { id: number } }
  | { type: 'SET_FILTER'; payload: { filter: 'all' | 'active' | 'completed' } }
  | { type: 'FETCH_TODOS_REQUEST' }
  | { type: 'FETCH_TODOS_SUCCESS'; payload: { todos: TodoItem[] } }
  | { type: 'FETCH_TODOS_FAILURE'; payload: { error: string } };

const todoReducer: Reducer<TodoState> = (state, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [
          ...state.todos,
          {
            id: Date.now(),
            text: (action.payload as any).text,
            completed: false,
            createdAt: Date.now(),
          },
        ],
      };
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === (action.payload as any).id ? { ...t, completed: !t.completed } : t
        ),
      };
    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter((t) => t.id !== (action.payload as any).id),
      };
    case 'SET_FILTER':
      return { ...state, filter: (action.payload as any).filter };
    case 'FETCH_TODOS_REQUEST':
      return { ...state, loading: true, error: null };
    case 'FETCH_TODOS_SUCCESS':
      return { ...state, loading: false, todos: (action.payload as any).todos };
    case 'FETCH_TODOS_FAILURE':
      return { ...state, loading: false, error: (action.payload as any).error };
    default:
      return state;
  }
};

// 创建 Store + 中间件
const store = new Store<TodoState>(todoReducer, initialState);
store.use(loggerMiddleware);
store.use(thunkMiddleware);

// Action Creators
const actions = {
  addTodo: (text: string): TodoAction => ({ type: 'ADD_TODO', payload: { text } }),
  toggleTodo: (id: number): TodoAction => ({ type: 'TOGGLE_TODO', payload: { id } }),
  deleteTodo: (id: number): TodoAction => ({ type: 'DELETE_TODO', payload: { id } }),
  setFilter: (filter: 'all' | 'active' | 'completed'): TodoAction => ({
    type: 'SET_FILTER',
    payload: { filter },
  }),
  // 异步 Action (Thunk)
  fetchTodos: (): ThunkAction<TodoState> => {
    return async (dispatch, getState) => {
      dispatch({ type: 'FETCH_TODOS_REQUEST' });
      try {
        const res = await fetch('/api/todos');
        const todos = await res.json();
        dispatch({ type: 'FETCH_TODOS_SUCCESS', payload: { todos } });
      } catch (err: any) {
        dispatch({ type: 'FETCH_TODOS_FAILURE', payload: { error: err.message } });
      }
    };
  },
};

// 使用
store.subscribe(() => {
  const state = store.getState();
  console.log('State changed:', state);
  // 这里可以触发 React 重新渲染
});

store.dispatch(actions.addTodo('Learn MVC'));
store.dispatch(actions.addTodo('Learn MVVM'));
store.dispatch(actions.toggleTodo(1));
```

---

## 五、微前端架构

### 5.1 为什么需要微前端？

```
单体前端的问题（团队 > 10 人）：
├── 构建时间 > 5 分钟 → 开发效率低
├── 一次部署全量更新 → 风险高
├── 技术栈锁定 → 无法引入新框架
├── 代码库臃肿 → 新人上手困难
└── 团队耦合 → A 团队改代码影响 B 团队

微前端解决：
├── 每个子应用独立构建/部署
├── 不同团队可用不同技术栈
├── 渐进式迁移（老项目包裹）
├── 按需加载（只加载当前路由的子应用）
└── 团队自治（独立 CI/CD）
```

### 5.2 微前端方案对比

```
┌────────────────┬──────────────┬──────────────┬──────────────┐
│   方案         │   隔离方式    │   通信方式    │   适用场景   │
├────────────────┼──────────────┼──────────────┼──────────────┤
│ qiankun        │ Shadow DOM   │ props/actions │ Vue/React 混合│
│ single-spa     │ 手动管理     │ CustomEvent   │ 灵活定制     │
│ Module Federation│ 无隔离     │ import/export  │ 同技术栈     │
│ iframe         │ 浏览器原生    │ postMessage   │ 完全隔离     │
│ Web Components  │ Shadow DOM   │ CustomEvent   │ 组件级复用   │
└────────────────┴──────────────┴──────────────┴──────────────┘
```

### 5.3 手写 Mini 微前端框架

```typescript
// ===== 微前端核心：路由分发 + 应用生命周期 =====

interface MicroAppConfig {
  name: string;
  entry: string; // HTML 入口
  activeRule: string | ((location: Location) => boolean);
  container?: string;
  props?: Record<string, any>; // 传递给子应用的数据
}

interface MicroAppInstance {
  name: string;
  status: 'NOT_LOADED' | 'LOADING' | 'MOUNTED' | 'UNMOUNTING';
  container: HTMLElement;
  config: MicroAppConfig;
}

class MicroFrontend {
  private apps: Map<string, MicroAppInstance> = new Map();
  private configs: MicroAppConfig[] = [];
  private globalProps: Record<string, any> = {};
  private beforeLoad?: (name: string) => Promise<void>;
  private afterMount?: (name: string) => void;

  // 注册子应用
  register(configs: MicroAppConfig[]): this {
    this.configs.push(...configs);
    return this;
  }

  // 设置全局 props
  setGlobalProps(props: Record<string, any>): this {
    this.globalProps = { ...this.globalProps, ...props };
    return this;
  }

  // 生命周期钩子
  beforeLoadHook(fn: (name: string) => Promise<void>): this {
    this.beforeLoad = fn;
    return this;
  }

  afterMountHook(fn: (name: string) => void): this {
    this.afterMount = fn;
    return this;
  }

  // 启动（监听路由变化）
  start(): void {
    this.checkAppMatch();
    window.addEventListener('hashchange', () => this.checkAppMatch());
    window.addEventListener('popstate', () => this.checkAppMatch());
  }

  // 检查并加载匹配的子应用
  private async checkAppMatch(): Promise<void> {
    const matchedConfigs = this.configs.filter((config) => {
      if (typeof config.activeRule === 'function') {
        return config.activeRule(window.location);
      }
      return window.location.pathname.startsWith(config.activeRule);
    });

    const matchedNames = new Set(matchedConfigs.map((c) => c.name));

    // 卸载不匹配的应用
    for (const [name, app] of this.apps) {
      if (!matchedNames.has(name)) {
        await this.unmountApp(name);
      }
    }

    // 加载匹配的应用
    for (const config of matchedConfigs) {
      if (!this.apps.has(config.name)) {
        await this.loadApp(config);
      }
    }
  }

  // 加载子应用
  private async loadApp(config: MicroAppConfig): Promise<void> {
    const instance: MicroAppInstance = {
      name: config.name,
      status: 'LOADING',
      container: this.createContainer(config),
      config,
    };
    this.apps.set(config.name, instance);

    try {
      if (this.beforeLoad) await this.beforeLoad(config.name);

      // 加载 HTML
      const html = await fetch(config.entry).then((r) => r.text());
      instance.container.innerHTML = html;

      // 执行 JS（提取 <script> 标签）
      await this.execScripts(instance.container, config);

      instance.status = 'MOUNTED';

      // 通知子应用挂载
      const mountEvent = new CustomEvent('micro-app:mount', {
        detail: { props: { ...this.globalProps, ...config.props } },
      });
      instance.container.dispatchEvent(mountEvent);

      if (this.afterMount) this.afterMount(config.name);
    } catch (err) {
      console.error(`Failed to load app ${config.name}:`, err);
      instance.container.innerHTML = `<div style="color:red">Failed to load ${config.name}</div>`;
    }
  }

  // 卸载子应用
  private async unmountApp(name: string): Promise<void> {
    const app = this.apps.get(name);
    if (!app) return;

    app.status = 'UNMOUNTING';

    // 通知子应用卸载
    const unmountEvent = new CustomEvent('micro-app:unmount');
    app.container.dispatchEvent(unmountEvent);

    // 清理
    app.container.innerHTML = '';
    if (app.container.parentNode) {
      app.container.parentNode.removeChild(app.container);
    }
    this.apps.delete(name);
  }

  // 创建容器
  private createContainer(config: MicroAppConfig): HTMLElement {
    const containerId = `micro-app-${config.name}`;
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'width: 100%; min-height: 100vh;';
      const target = config.container
        ? (document.querySelector(config.container) as HTMLElement)
        : document.body;
      target.appendChild(container);
    }
    return container;
  }

  // 执行脚本
  private execScripts(container: HTMLElement, config: MicroAppConfig): Promise<void> {
    const scripts = container.querySelectorAll('script');
    const promises: Promise<void>[] = [];

    scripts.forEach((script) => {
      if (script.type === 'module' || script.src) {
        const newScript = document.createElement('script');
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        const p = new Promise<void>((resolve, reject) => {
          newScript.onload = () => resolve();
          newScript.onerror = () => reject(new Error(`Script load failed: ${script.src}`));
        });
        promises.push(p);
        document.head.appendChild(newScript);
      } else {
        try {
          eval(script.textContent);
        } catch (e) {
          console.error('Script eval error:', e);
        }
      }
    });

    return Promise.all(promises).then(() => {});
  }

  // 手动加载/卸载
  async load(name: string): Promise<void> {
    const config = this.configs.find((c) => c.name === name);
    if (!config) throw new Error(`App ${name} not registered`);
    await this.loadApp(config);
  }

  async unload(name: string): Promise<void> {
    await this.unmountApp(name);
  }

  // 获取应用状态
  getStatus(name: string): string | undefined {
    return this.apps.get(name)?.status;
  }
}

// ===== 使用示例 =====
const microApp = new MicroFrontend();

microApp
  .register([
    {
      name: 'dashboard',
      entry: '/apps/dashboard/index.html',
      activeRule: '/dashboard',
    },
    {
      name: 'products',
      entry: '/apps/products/index.html',
      activeRule: '/products',
    },
    {
      name: 'settings',
      entry: '/apps/settings/index.html',
      activeRule: '/settings',
    },
  ])
  .setGlobalProps({
    user: { name: 'admin', role: 'super' },
    theme: 'dark',
    apiBase: 'https://api.example.com',
  })
  .beforeLoadHook(async (name) => {
    console.log(`Loading app: ${name}`);
    // 可以显示 loading 动画
  })
  .afterMountHook((name) => {
    console.log(`App mounted: ${name}`);
  })
  .start();

// 子应用侧（接收 props）
// document.addEventListener('micro-app:mount', (e: any) => {
//   const { props } = e.detail;
//   console.log('Received props:', props);
//   // 使用 props 初始化应用
// });
//
// document.addEventListener('micro-app:unmount', () => {
//   // 清理定时器、事件监听器等
// });
```

### 5.4 Module Federation 配置示例

```javascript
// ===== 主应用 (Host) webpack.config.js =====
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
        products: 'products@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};

// 使用远程模块
// const Dashboard = React.lazy(() => import('dashboard/App'));
// const Products = React.lazy(() => import('products/App'));

// ===== 子应用 (Remote) webpack.config.js =====
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App',
        './Header': './src/components/Header',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};
```

---

## 六、完整应用架构设计 — CloudBoard

### 6.1 项目背景

```
CloudBoard — 云端项目管理平台

业务需求：
├── 项目管理（CRUD、看板视图、甘特图）
├── 团队协作（实时编辑、评论、@提及）
├── 文件管理（上传、预览、版本控制）
├── 数据分析（图表、报表、导出）
├── 系统管理（用户、角色、权限、审计日志）
└── 国际化（中/英/日）

团队规模：12 人（3 个小组）
├── 前端组（6 人）：3 个小组各 2 人
├── 后端组（4 人）
└── 设计/测试（各 1 人）
```

### 6.2 架构决策记录 (ADR)

```markdown
## ADR-001: 微前端架构选型

**状态：** 已接受
**上下文：** 12 人前端团队，3 个业务线并行开发，需要独立部署
**决策：** 采用 qiankun + Module Federation 混合方案
**理由：**
- qiankun 处理跨技术栈隔离（Vue3 + React 混用）
- Module Federation 处理同技术栈的组件共享
- 比纯 iframe 方案更好的用户体验
- 比纯 single-spa 更完善的生态
**权衡：**
- 增加构建复杂度 → 通过内部 CLI 工具封装
- 样式隔离问题 → Shadow DOM + CSS Modules
- 通信开销 → 全局 Store + CustomEvent 分级处理

## ADR-002: 状态管理选型

**状态：** 已接受
**上下文：** 需要跨子应用共享用户/主题/权限状态
**决策：** Pinia（Vue 子应用）+ Zustand（React 子应用）+ 全局 EventBus
**理由：**
- Pinia 是 Vue 3 官方推荐，TypeScript 友好
- Zustand 轻量（1KB），适合 React 子应用
- 跨应用通信用 EventBus（发布订阅模式）
**权衡：**
- 两套状态管理 → 通过统一接口层封装

## ADR-003: 构建工具选型

**状态：** 已接受
**上下文：** 需要快速开发体验和高效生产构建
**决策：** Vite（开发）+ esbuild（生产）
**理由：**
- Vite HMR 冷启动 < 1s
- esbuild 生产构建比 Webpack 快 10-100x
- 生态成熟，插件丰富
```

### 6.3 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        CloudBoard 平台                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  主应用      │  │  子应用      │  │  子应用      │            │
│  │  (Shell)     │  │  (Dashboard) │  │  (Products)  │            │
│  │  Vue3 + TS   │  │  Vue3 + TS   │  │  React + TS  │            │
│  │              │  │              │  │              │            │
│  │  - 导航栏    │  │  - 项目概览  │  │  - 产品列表  │            │
│  │  - 侧边栏    │  │  - 统计图表  │  │  - 产品详情  │            │
│  │  - 用户菜单  │  │  - 快捷操作  │  │  - 产品分析  │            │
│  │  - 全局搜索  │  │              │  │              │            │
│  │  - 主题切换  │  │              │  │              │            │
│  └──────┬──────┘  └─────────────┘  └─────────────┘            │
│         │                                                      │
│         │  qiankun 路由分发 + props 通信                       │
│         │                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  子应用      │  │  子应用      │  │  共享模块    │            │
│  │  (Files)     │  │  (Settings)  │  │  (MF)       │            │
│  │  Vue3 + TS   │  │  Vue3 + TS   │  │              │            │
│  │              │  │              │  │  - Button    │            │
│  │  - 文件列表  │  │  - 用户管理  │  │  - Table     │            │
│  │  - 文件预览  │  │  - 角色权限  │  │  - Form      │            │
│  │  - 版本历史  │  │  - 审计日志  │  │  - Modal     │            │
│  │              │  │              │  │  - DatePicker│            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  基础设施层                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ API 网关  │ │ 认证服务  │ │ 文件服务  │ │ WebSocket │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 目录结构

```
cloudboard/
├── packages/
│   ├── shell/                    # 主应用 (qiankun master)
│   │   ├── src/
│   │   │   ├── router/           # 路由配置（子应用注册）
│   │   │   ├── layout/           # 全局布局（Header/Sidebar/Footer）
│   │   │   ├── store/            # Pinia 全局状态
│   │   │   ├── components/       # 共享 UI 组件
│   │   │   ├── utils/            # 工具函数
│   │   │   ├── api/              # 全局 API 封装
│   │   │   └── micro/            # 微前端配置
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── app-dashboard/            # 子应用：Dashboard (Vue3)
│   │   ├── src/
│   │   │   ├── views/
│   │   │   │   ├── Overview.vue      # 项目概览
│   │   │   │   ├── Charts.vue        # 统计图表
│   │   │   │   └── QuickActions.vue  # 快捷操作
│   │   │   ├── store/            # Pinia 局部状态
│   │   │   ├── components/       # 局部组件
│   │   │   ├── api/              # 局部 API
│   │   │   └── main.ts           # 微前端入口
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── app-products/             # 子应用：Products (React)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── ProductList.tsx
│   │   │   │   ├── ProductDetail.tsx
│   │   │   │   └── ProductAnalysis.tsx
│   │   │   ├── store/            # Zustand 状态
│   │   │   ├── components/
│   │   │   ├── api/
│   │   │   └── main.tsx          # 微前端入口
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── app-files/                # 子应用：Files (Vue3)
│   ├── app-settings/             # 子应用：Settings (Vue3)
│   │
│   ├── shared-ui/                # 共享 UI 组件库 (Module Federation)
│   │   ├── src/
│   │   │   ├── Button/
│   │   │   ├── Table/
│   │   │   ├── Form/
│   │   │   ├── Modal/
│   │   │   └── DatePicker/
│   │   └── package.json
│   │
│   ├── shared-utils/             # 共享工具库
│   │   ├── src/
│   │   │   ├── request.ts        # 统一请求封装
│   │   │   ├── auth.ts           # 认证工具
│   │   │   ├── i18n.ts           # 国际化
│   │   │   └── event-bus.ts      # 跨应用通信
│   │   └── package.json
│   │
│   └── shared-types/             # 共享类型定义
│       ├── src/
│       │   ├── user.d.ts
│       │   ├── project.d.ts
│       │   └── api.d.ts
│       └── package.json
│
├── scripts/                      # 构建脚本
├── .github/workflows/            # CI/CD
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

### 6.5 核心实现

#### 6.5.1 主应用 — 微前端注册

```typescript
// packages/shell/src/micro/registerApps.ts
import { registerMicroApps, start, initGlobalState } from 'qiankun';

interface MicroApp {
  name: string;
  entry: string;
  activeRule: string;
  container: string;
}

const apps: MicroApp[] = [
  {
    name: 'dashboard',
    entry: import.meta.env.VITE_DASHBOARD_ENTRY || '//localhost:3001',
    activeRule: '/dashboard',
    container: '#subapp-container',
  },
  {
    name: 'products',
    entry: import.meta.env.VITE_PRODUCTS_ENTRY || '//localhost:3002',
    activeRule: '/products',
    container: '#subapp-container',
  },
  {
    name: 'files',
    entry: import.meta.env.VITE_FILES_ENTRY || '//localhost:3003',
    activeRule: '/files',
    container: '#subapp-container',
  },
  {
    name: 'settings',
    entry: import.meta.env.VITE_SETTINGS_ENTRY || '//localhost:3004',
    activeRule: '/settings',
    container: '#subapp-container',
  },
];

// 初始化全局状态
const globalState = initGlobalState({
  user: null,
  theme: 'light',
  locale: 'zh-CN',
  permissions: [],
});

// 注册子应用
registerMicroApps(
  apps.map((app) => ({
    ...app,
    props: {
      // 传递给子应用的初始数据
      apiBase: import.meta.env.VITE_API_BASE,
      globalState,
      // 子应用调用主应用方法
      onThemeChange: (theme: string) => {
        globalState.setTheme(theme);
      },
      onLocaleChange: (locale: string) => {
        globalState.setLocale(locale);
      },
    },
    // 生命周期
    beforeLoad: [
      (app) => console.log('beforeLoad', app.name),
    ],
    beforeMount: [
      (app) => console.log('beforeMount', app.name),
    ],
    afterMount: [
      (app) => console.log('afterMount', app.name),
    ],
    afterUnmount: [
      (app) => console.log('afterUnmount', app.name),
    ],
  })),
  {
    // 全局生命周期
    beforeLoad: (app) => console.log('🚀 Loading app:', app.name),
    afterMount: (app) => console.log('✅ App mounted:', app.name),
  }
);

// 全局状态监听
globalState.onGlobalStateChange((state, prev) => {
  console.log('Global state changed:', state, prev);
});

export { globalState };
export default () => start({ sandbox: { strictStyleIsolation: true } });
```

#### 6.5.2 子应用入口 — 生命周期适配

```typescript
// packages/app-dashboard/src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { setupStore } from './store';

let app: ReturnType<typeof createApp> | null = null;

function render(props: any = {}) {
  const { container, apiBase, globalState } = props;
  const el = container
    ? container.querySelector('#app')
    : document.getElementById('app');

  app = createApp(App);
  app.use(router);
  setupStore(app, { apiBase, globalState });
  app.mount(el!);
}

// 独立运行（不依赖 qiankun）
if (!(window as any).__qiankun__) {
  render();
}

// qiankun 生命周期
export async function bootstrap(props: any) {
  console.log('[Dashboard] bootstrap', props);
}

export async function mount(props: any) {
  console.log('[Dashboard] mount', props);
  render(props);
}

export async function unmount() {
  console.log('[Dashboard] unmount');
  app?.unmount();
  app = null;
}
```

#### 6.5.3 跨应用通信 — EventBus

```typescript
// packages/shared-utils/src/event-bus.ts
type EventCallback = (...args: any[]) => void;

class EventBus {
  private events: Map<string, Set<EventCallback>> = new Map();

  // 发布事件
  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          console.error(`EventBus error in ${event}:`, e);
        }
      });
    }
  }

  // 订阅事件
  on(event: string, fn: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  // 取消订阅
  off(event: string, fn: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(fn);
    }
  }

  // 一次性订阅
  once(event: string, fn: EventCallback): () => void {
    const wrapper = (...args: any[]) => {
      fn(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  // 清除所有监听
  clear(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// 单例
export const eventBus = new EventBus();

// 预定义事件常量
export const AppEvents = {
  // 用户相关
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_UPDATE: 'user:update',

  // 项目相关
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  // 全局
  THEME_CHANGE: 'theme:change',
  LOCALE_CHANGE: 'locale:change',
  NOTIFICATION: 'notification',
} as const;
```

#### 6.5.4 统一请求封装

```typescript
// packages/shared-utils/src/request.ts
interface RequestConfig extends RequestInit {
  baseURL?: string;
  timeout?: number;
  params?: Record<string, any>;
  data?: any;
  transformRequest?: (data: any) => any;
  transformResponse?: (data: any) => any;
  _retryCount?: number;
  _maxRetries?: number;
}

interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

class RequestClient {
  private baseURL: string;
  private timeout: number;
  private interceptors: {
    request: Array<(config: RequestConfig) => RequestConfig | Promise<RequestConfig>>;
    response: Array<(response: Response) => Response | Promise<Response>>;
    error: Array<(error: Error) => void>;
  };

  constructor(baseURL: string, timeout = 10000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.interceptors = {
      request: [],
      response: [],
      error: [],
    };
  }

  // 添加拦截器
  useRequest(fn: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>): this {
    this.interceptors.request.push(fn);
    return this;
  }

  useResponse(fn: (response: Response) => Response | Promise<Response>): this {
    this.interceptors.response.push(fn);
    return this;
  }

  useError(fn: (error: Error) => void): this {
    this.interceptors.error.push(fn);
    return this;
  }

  // 核心请求方法
  async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    let {
      url,
      method = 'GET',
      params,
      data,
      timeout = this.timeout,
      transformRequest,
      transformResponse,
      _retryCount = 0,
      _maxRetries = 3,
      ...rest
    } = config;

    // 拼接 URL
    if (params) {
      const qs = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>)
      ).toString();
      url = `${url}?${qs}`;
    }

    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    // 请求拦截器
    let finalConfig = { url: fullURL, method, timeout, ...rest };
    for (const interceptor of this.interceptors.request) {
      finalConfig = await interceptor(finalConfig);
    }

    // 转换请求数据
    if (data && transformRequest) {
      finalConfig.body = JSON.stringify(transformRequest(data));
    } else if (data) {
      finalConfig.body = JSON.stringify(data);
    }
    if (!finalConfig.headers) finalConfig.headers = {};
    if (!(finalConfig.headers as any)['Content-Type']) {
      (finalConfig.headers as any)['Content-Type'] = 'application/json';
    }

    // 超时控制
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    finalConfig.signal = controller.signal;

    try {
      const response = await fetch(fullURL, finalConfig);
      clearTimeout(timer);

      const res: Response<T> = {
        data: await response.json(),
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };

      // 响应拦截器
      for (const interceptor of this.interceptors.response) {
        const result = await interceptor(res);
        if (result) Object.assign(res, result);
      }

      return res;
    } catch (error: any) {
      clearTimeout(timer);

      // 重试逻辑
      if (_retryCount < _maxRetries && this.isRetryable(error)) {
        await this.delay(Math.pow(2, _retryCount) * 1000);
        return this.request({ ...config, _retryCount: _retryCount + 1 });
      }

      // 错误拦截器
      for (const interceptor of this.interceptors.error) {
        interceptor(error);
      }
      throw error;
    }
  }

  // 快捷方法
  get<T>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ url, method: 'GET', ...config });
  }

  post<T>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ url, method: 'POST', data, ...config });
  }

  put<T>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ url, method: 'PUT', data, ...config });
  }

  delete<T>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ url, method: 'DELETE', ...config });
  }

  private isRetryable(error: Error): boolean {
    return error.name === 'AbortError' || error.message.includes('fetch');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 使用示例
const request = new RequestClient('/api');

// Auth 拦截器
request.useRequest(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 错误处理拦截器
request.useError((error) => {
  console.error('Request error:', error);
  // 可以触发全局通知
});

// 401 拦截器
request.useResponse((response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return response;
});
```

### 6.6 性能优化策略

```
┌─────────────────────────────────────────────────────────────┐
│  CloudBoard 性能优化策略                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 子应用按需加载                                           │
│     - qiankun 路由级懒加载                                   │
│     - 预加载：鼠标 hover 导航时预加载子应用                   │
│                                                             │
│  2. 共享依赖去重                                             │
│     - Module Federation 共享 Vue/React                       │
│     - 避免每个子应用打包同一份框架                            │
│                                                             │
│  3. 资源缓存策略                                             │
│     - Shell: 强缓存 (contenthash)                            │
│     - 子应用: 协商缓存 (ETag)                                │
│     - 静态资源: CDN + 长期缓存                                │
│                                                             │
│  4. 首屏优化                                                 │
│     - Shell 内联关键 CSS                                     │
│     - 子应用骨架屏 (Skeleton)                                │
│     - 关键 API 预取 (Preload)                                │
│                                                             │
│  5. 运行时优化                                               │
│     - 虚拟滚动 (万级列表)                                    │
│     - 图片懒加载 (IntersectionObserver)                      │
│     - 防抖/节流 (搜索/滚动)                                  │
│     - Web Worker (图表渲染/数据计算)                         │
│                                                             │
│  6. 构建优化                                                 │
│     - Vite 开发: 原生 ESM (无打包)                           │
│     - esbuild 生产: 快速编译                                 │
│     - 代码分割: 路由级 + 组件级                              │
│     - Tree Shaking: 移除未使用代码                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.7 安全策略

```
┌─────────────────────────────────────────────────────────────┐
│  CloudBoard 安全策略                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. XSS 防护                                                 │
│     - Vue/React 自动转义                                     │
│     - 富文本: DOMPurify 过滤                                 │
│     - CSP 头: default-src 'self'                             │
│                                                             │
│  2. CSRF 防护                                                │
│     - SameSite: Strict Cookie                                │
│     - CSRF Token (非 GET 请求)                               │
│     - Referer 验证                                           │
│                                                             │
│  3. 认证授权                                                 │
│     - JWT + Refresh Token                                    │
│     - RBAC 权限模型                                          │
│     - 接口级权限校验                                         │
│                                                             │
│  4. 微前端安全                                               │
│     - JS 沙箱 (Proxy 隔离)                                   │
│     - CSS 隔离 (Shadow DOM)                                  │
│     - 子应用签名验证                                         │
│                                                             │
│  5. 数据安全                                                 │
│     - HTTPS 全站                                             │
│     - 敏感数据脱敏                                           │
│     - 操作审计日志                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 七、架构模式选择指南

### 7.1 决策树

```
开始选型
  │
  ├─ 团队规模？
  │   ├─ 1-3 人
  │   │   └─ → 单体应用 (Vite + Vue3/React)
  │   │       └─ 状态: Pinia/Zustand
  │   │       └─ 架构: MVVM (Vue) 或 Flux (React)
  │   │
  │   ├─ 4-10 人
  │   │   └─ → 模块化单体 (Monorepo)
  │   │       └─ 清晰模块边界
  │   │       └─ 共享组件库
  │   │       └─ 架构: 按模块选 MVC/MVVM/Flux
  │   │
  │   └─ 10+ 人 / 多团队
  │       └─ → 微前端
  │           ├─ 同技术栈 → Module Federation
  │           └─ 混合技术栈 → qiankun
  │
  ├─ 需要 SEO？
  │   ├─ 是 → SSR (Nuxt/Next)
  │   └─ 否 → CSR
  │
  └─ 性能要求？
      ├─ 极致首屏 → Island Architecture (Astro)
      ├─ 标准 → SSR + 代码分割
      └─ 普通 → CSR + 懒加载
```

### 7.2 模式适用场景速查

```
┌──────────────┬──────────────────────────────────────────────┐
│  场景        │  推荐架构                                     │
├──────────────┼──────────────────────────────────────────────┤
│  个人博客    │  Astro (Islands) / Hexo (SSG)                │
│  营销页面    │  静态 HTML + 少量 JS                          │
│  后台管理系统 │  Vue3 + Pinia (MVVM) 或 React + Zustand      │
│  数据可视化  │  React + D3 + Redux (Flux)                   │
│  电商前台    │  Next.js (SSR) + 状态管理                     │
│  即时通讯    │  WebSocket + 单向数据流                       │
│  企业级平台  │  微前端 + 模块化架构                           │
│  设计系统    │  Web Components + Storybook                   │
│  渐进式迁移  │  qiankun 包裹老项目                           │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 八、面试高频考点

### 8.1 MVC vs MVVM vs Flux

**Q: 三种架构模式的核心区别是什么？**

```
MVC:
- 控制器 (Controller) 是核心，手动协调 Model 和 View
- 数据同步需要手动编写
- 适合简单场景，复杂场景 Controller 膨胀

MVVM:
- ViewModel 通过响应式系统自动同步 Model 和 View
- 声明式模板，开发效率高
- 适合表单密集型应用 (Vue/Knockout)

Flux/Redux:
- 单向数据流，状态变更可预测
- 唯一 Store + 不可变更新 + 时间旅行
- 适合大型应用、复杂状态管理 (React+Redux)
```

### 8.2 微前端核心问题

**Q: 微前端要解决什么问题？有什么缺点？**

```
解决的问题：
1. 团队规模增长后的协作效率
2. 技术栈演进的灵活性
3. 独立部署和发布
4. 渐进式重构老项目

缺点/挑战：
1. 构建和部署复杂度增加
2. 样式隔离（CSS 污染）
3. JS 隔离（全局变量冲突）
4. 跨应用通信
5. 共享依赖（重复打包）
6. 开发体验（本地调试多个应用）
```

**Q: qiankun 和 Module Federation 怎么选？**

```
qiankun:
- 基于 single-spa
- 支持跨技术栈（Vue + React + Angular 混用）
- JS 沙箱 (Proxy) + CSS 隔离 (Shadow DOM)
- 路由级隔离（每个子应用独立路由）
- 适合：多团队协作、技术栈不统一

Module Federation:
- Webpack 5 原生特性
- 组件/模块级共享（import 远程模块）
- 无隔离（共享同一运行时）
- 依赖版本协商
- 适合：同技术栈、需要组件级共享
```

### 8.3 架构设计实战

**Q: 如果让你设计一个类似飞书的项目，你会怎么架构？**

```
参考 CloudBoard 架构：

1. 微前端层 (qiankun)
   - Shell: 导航/搜索/通知/用户菜单
   - 子应用: 文档/表格/看板/日历/邮箱

2. 状态管理层
   - 全局: 用户/权限/主题 (Pinia)
   - 局部: 各子应用独立状态 (Zustand)
   - 跨应用: EventBus

3. 通信层
   - REST API (常规数据)
   - WebSocket (实时协作)
   - CRDT (冲突解决)

4. 性能层
   - 子应用预加载
   - 虚拟滚动
   - Web Worker
   - 增量更新

5. 安全层
   - JWT + RBAC
   - CSP
   - 沙箱隔离
```

---

## 九、自测题

### 9.1 基础题

1. MVC 模式中，View 能直接修改 Model 吗？为什么？
2. MVVM 的双向绑定是如何实现的？（Proxy vs Object.defineProperty）
3. Redux 的三大原则是什么？
4. 微前端和 iframe 方案有什么区别？
5. Module Federation 的 shared 配置有什么作用？

### 9.2 进阶题

6. 手写一个简易的响应式系统（Proxy + Dep）
7. 如何实现微前端的全局状态共享？
8. 子应用之间如何通信？列举 3 种方案
9. 微前端的样式隔离有哪些方案？各有什么优缺点？
10. 如何在微前端架构下实现权限管理？

### 9.3 实战题

11. 设计一个电商平台的架构（商品/购物车/订单/支付）
12. 将现有 jQuery 项目迁移到 Vue3，如何渐进式进行？
13. 设计一个支持插件化扩展的编辑器架构
14. 如何在微前端中处理全局 Loading 状态？
15. 设计一个实时协作编辑器的架构（类似 Google Docs）

---

## 十、总结

### 10.1 核心要点

```
1. MVC 是基础，理解数据流向是关键
2. MVVM 通过响应式降低开发成本，适合表单场景
3. Flux/Redux 通过单向数据流保证可预测性，适合复杂状态
4. 微前端是组织问题的技术方案，不是银弹
5. 架构选型 = 团队规模 × 业务复杂度 × 技术栈 × 演进需求
6. 好的架构 = 清晰的边界 + 可预测的数据流 + 可测试性
```

### 10.2 学习路径

```
┌─────────────────────────────────────────────────┐
│  前端架构学习路径                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  阶段 1: 理解模式                                 │
│  ├─ MVC 手写实现 ✅                               │
│  ├─ MVVM 响应式引擎 ✅                            │
│  └─ Flux/Redux 手写 ✅                            │
│                                                 │
│  阶段 2: 微前端实践                               │
│  ├─ qiankun 入门                                 │
│  ├─ Module Federation 实践                       │
│  └─ 跨应用通信方案                               │
│                                                 │
│  阶段 3: 架构设计                                 │
│  ├─ 完整项目架构设计 ✅ (CloudBoard)              │
│  ├─ ADR 文档编写                                 │
│  └─ 架构评审实践                                 │
│                                                 │
│  阶段 4: 高级专题                                 │
│  ├─ CRDT 实时协作                                │
│  ├─ 微前端性能优化                               │
│  └─ 架构演进与重构                               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 10.3 本次训练产出

```
✅ MVC 手写实现 (Model/View/Controller + Todo 示例)
✅ MVVM 手写实现 (响应式引擎 + 模板编译 + Todo 示例)
✅ Flux/Redux 手写实现 (Store + Reducer + 中间件 + Todo 示例)
✅ 微前端手写实现 (路由分发 + 生命周期 + 通信)
✅ Module Federation 配置示例
✅ CloudBoard 完整架构设计 (目录结构 + 核心实现 + 性能 + 安全)
✅ 架构选型决策树 + 场景速查表
✅ 面试高频考点 + 自测题
```

---

_架构不是选最炫的技术，而是选最适合的方案。好的架构师不是技术最牛的，而是最能平衡各种约束的人。_
