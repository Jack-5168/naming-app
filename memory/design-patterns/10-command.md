# 命令模式 (Command Pattern)

## 核心思想

将**请求**封装为对象，使得可以用不同的请求参数化对象，并且支持请求的排队、记录日志和撤销操作。

> 一句话：把"做一件事"包装成一个对象，这个对象可以存储、传递、撤销、重做。

## 什么时候用

- 需要撤销/重做 (Undo/Redo)
- 需要命令队列 / 命令日志
- 需要将请求发送者与执行者解耦
- 需要宏命令（组合多个命令为一个）

## 核心角色

```
Invoker（调用者）──发出命令──→ Command（命令对象）──执行──→ Receiver（接收者）
                                    ↑
                              命令对象持有 Receiver 引用
                              并记录执行状态（支持撤销）
```

## 实现 1：文本编辑器 Undo/Redo（经典场景）

```js
// ====== Receiver：被操作的对象 ======
class TextEditor {
  constructor() {
    this.content = "";
  }

  write(text) {
    this.content += text;
    return this.content;
  }

  delete(chars) {
    const removed = this.content.slice(-chars);
    this.content = this.content.slice(0, -chars);
    return removed;
  }

  clear() {
    const removed = this.content;
    this.content = "";
    return removed;
  }

  getContent() {
    return this.content;
  }
}

// ====== Command 接口 ======
class Command {
  execute() {
    throw new Error("Not implemented");
  }
  undo() {
    throw new Error("Not implemented");
  }
}

// ====== Concrete Commands ======
class WriteCommand extends Command {
  constructor(editor, text) {
    super();
    this.editor = editor;
    this.text = text;
  }

  execute() {
    this.editor.write(this.text);
  }

  undo() {
    this.editor.delete(this.text.length);
  }
}

class DeleteCommand extends Command {
  constructor(editor, count) {
    super();
    this.editor = editor;
    this.count = count;
    this.deletedText = "";
  }

  execute() {
    this.deletedText = this.editor.delete(this.count);
  }

  undo() {
    this.editor.write(this.deletedText);
  }
}

class ClearCommand extends Command {
  constructor(editor) {
    super();
    this.editor = editor;
    this.deletedText = "";
  }

  execute() {
    this.deletedText = this.editor.clear();
  }

  undo() {
    this.editor.write(this.deletedText);
  }
}

// ====== Invoker：命令管理器 ======
class CommandManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // 新操作后清空重做栈
    return command;
  }

  undo() {
    if (this.undoStack.length === 0) return null;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    return command;
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    return command;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
}

// ====== 使用 ======
const editor = new TextEditor();
const manager = new CommandManager();

manager.execute(new WriteCommand(editor, "Hello "));
manager.execute(new WriteCommand(editor, "World"));
console.log(editor.getContent()); // "Hello World"

manager.undo();
console.log(editor.getContent()); // "Hello "

manager.redo();
console.log(editor.getContent()); // "Hello World"

manager.execute(new DeleteCommand(editor, 5));
console.log(editor.getContent()); // "Hello "

manager.undo(); // 撤销删除
console.log(editor.getContent()); // "Hello World"

manager.undo(); // 撤销 "World"
manager.undo(); // 撤销 "Hello "
console.log(editor.getContent()); // ""
console.log(manager.canUndo()); // false
```

## 实现 2：异步命令队列（生产场景）

```js
class AsyncCommandQueue {
  constructor(maxConcurrency = 3) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrency = maxConcurrency;
    this.results = [];
    this.listeners = {
      complete: [],
      error: [],
      progress: [],
    };
  }

  on(event, fn) {
    this.listeners[event].push(fn);
    return this;
  }

  _emit(event, data) {
    this.listeners[event].forEach((fn) => fn(data));
  }

  add(command) {
    this.queue.push(command);
    this._runNext();
    return this;
  }

  async _runNext() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) return;

    this.running++;
    const command = this.queue.shift();

    try {
      const result = await command.execute();
      this.results.push({ command: command.name, result, status: "success" });
      this._emit("progress", {
        total: this.results.length + this.queue.length + (this.running - 1),
        completed: this.results.length,
        name: command.name,
      });
    } catch (error) {
      this.results.push({
        command: command.name,
        error: error.message,
        status: "error",
      });
      this._emit("error", { name: command.name, error });
      if (command.onFailure === "abort") throw error;
    }

    this.running--;
    this._runNext();

    if (this.running === 0 && this.queue.length === 0) {
      this._emit("complete", this.results);
    }
  }

  getResults() {
    return [...this.results];
  }
}

// 命令定义
class FetchCommand {
  constructor(name, url, options = {}) {
    this.name = name;
    this.url = url;
    this.options = options;
    this.onFailure = options.onFailure || "continue";
  }

  async execute() {
    const res = await fetch(this.url, {
      signal: AbortSignal.timeout(this.options.timeout || 5000),
      ...this.options,
    });
    return res.json();
  }
}

class TransformCommand {
  constructor(name, data, transformFn) {
    this.name = name;
    this.data = data;
    this.transformFn = transformFn;
  }

  async execute() {
    // 模拟异步处理
    await new Promise((r) => setTimeout(r, 100));
    return this.transformFn(this.data);
  }
}

class SaveCommand {
  constructor(name, key, value) {
    this.name = name;
    this.key = key;
    this.value = value;
  }

  async execute() {
    localStorage.setItem(this.key, JSON.stringify(this.value));
    return { saved: this.key, size: JSON.stringify(this.value).length };
  }
}

// 使用示例
const queue = new AsyncCommandQueue(2);

queue
  .on("progress", ({ completed, total, name }) =>
    console.log(`[${completed}/${total}] ${name} done`),
  )
  .on("error", ({ name, error }) => console.error(`❌ ${name}: ${error}`))
  .on("complete", (results) =>
    console.log("✅ All done:", results.length, "commands"),
  );

queue
  .add(new FetchCommand("fetch-users", "/api/users"))
  .add(new FetchCommand("fetch-orders", "/api/orders"))
  .add(new FetchCommand("fetch-products", "/api/products"))
  .add(
    new TransformCommand("merge-data", null, (data) => ({
      users: [],
      orders: [],
    })),
  )
  .add(new SaveCommand("save-cache", "app-data", { users: [], orders: [] }));
```

## 实现 3：宏命令（Macro Command）

```js
// 宏命令：组合多个命令为一个
class MacroCommand extends Command {
  constructor(name, commands = []) {
    super();
    this.name = name;
    this.commands = commands;
  }

  add(command) {
    this.commands.push(command);
    return this;
  }

  execute() {
    this.commands.forEach((cmd) => cmd.execute());
  }

  undo() {
    // 逆序撤销！
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

// ====== 图形编辑器场景 ======
class Shape {
  constructor(type, x, y, props = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.props = props;
    this.visible = true;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  show() {
    this.visible = true;
  }
  hide() {
    this.visible = false;
  }
}

class Canvas {
  constructor() {
    this.shapes = [];
  }

  add(shape) {
    this.shapes.push(shape);
    return shape;
  }

  remove(shape) {
    this.shapes = this.shapes.filter((s) => s !== shape);
    return shape;
  }

  getShapes() {
    return [...this.shapes];
  }
}

// 具体命令
class AddShapeCommand extends Command {
  constructor(canvas, shape) {
    super();
    this.canvas = canvas;
    this.shape = shape;
  }
  execute() {
    this.canvas.add(this.shape);
  }
  undo() {
    this.canvas.remove(this.shape);
  }
}

class MoveShapeCommand extends Command {
  constructor(shape, dx, dy) {
    super();
    this.shape = shape;
    this.dx = dx;
    this.dy = dy;
  }
  execute() {
    this.shape.move(this.dx, this.dy);
  }
  undo() {
    this.shape.move(-this.dx, -this.dy);
  }
}

class ToggleVisibilityCommand extends Command {
  constructor(shape) {
    super();
    this.shape = shape;
  }
  execute() {
    this.shape.visible ? this.shape.hide() : this.shape.show();
  }
  undo() {
    this.shape.visible ? this.shape.hide() : this.shape.show();
  }
}

// 宏命令使用
const canvas = new Canvas();
const manager = new CommandManager();

const rect = new Shape("rect", 0, 0, { width: 100, height: 50 });
const circle = new Shape("circle", 50, 50, { radius: 25 });

// 创建宏命令：同时添加两个形状
const addBoth = new MacroCommand("add-both-shapes")
  .add(new AddShapeCommand(canvas, rect))
  .add(new AddShapeCommand(canvas, circle));

manager.execute(addBoth);
console.log(canvas.getShapes().length); // 2

manager.undo(); // 一次性撤销两个
console.log(canvas.getShapes().length); // 0

// 复杂宏命令
const createAndPosition = new MacroCommand("create-and-position")
  .add(new AddShapeCommand(canvas, rect))
  .add(new MoveShapeCommand(rect, 100, 100))
  .add(new AddShapeCommand(canvas, circle))
  .add(new MoveShapeCommand(circle, 200, 200));

manager.execute(createAndPosition);
console.log(canvas.getShapes().length); // 2
console.log(rect.x, rect.y); // 100 100
console.log(circle.x, circle.y); // 200 200

manager.undo(); // 全部撤销
console.log(canvas.getShapes().length); // 0
```

## JS 原生体现

| 原生 API / 场景                | 命令模式体现                           |
| ------------------------------ | -------------------------------------- |
| `setTimeout(fn, delay)`        | 将回调封装为延迟执行的命令             |
| DOM 事件监听                   | 事件对象就是命令，回调就是 Receiver    |
| Redux `dispatch(action)`       | action 是命令对象，reducer 是 Receiver |
| Node.js `child_process.exec()` | 命令对象封装进程执行                   |
| Promise                        | 异步命令的封装，支持链式编排           |
| `requestAnimationFrame(cb)`    | 将渲染操作封装为命令                   |

## 与其他模式组合

```js
// Command + Observer：命令执行后通知监听者
class ObservableCommandManager extends CommandManager {
  constructor() {
    super();
    this.history = []; // 命令日志
  }

  execute(command) {
    super.execute(command);
    this.history.push({
      command: command.constructor.name,
      timestamp: Date.now(),
    });
    // 通知监听者
    this._notify("commandExecuted", command);
  }

  _notify(event, data) {
    // 类似观察者模式的通知机制
    (this._listeners?.[event] || []).forEach((fn) => fn(data));
  }

  on(event, fn) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return this;
  }

  getHistory() {
    return [...this.history];
  }
}

// Command + Factory：根据类型创建命令
class CommandFactory {
  static create(type, ...args) {
    const map = {
      write: WriteCommand,
      delete: DeleteCommand,
      clear: ClearCommand,
    };
    const Cmd = map[type];
    if (!Cmd) throw new Error(`Unknown command: ${type}`);
    return new Cmd(...args);
  }
}

// 使用
const cmd = CommandFactory.create("write", editor, "Hello");
manager.execute(cmd);
```

## 关键要点

1. **命令对象化**：把"动作"变成可以存储、传递、组合的对象
2. **Undo/Redo 核心**：每个命令实现 `execute()` + `undo()`
3. **撤销逆序**：宏命令撤销时必须从后往前
4. **新操作清 Redo 栈**：撤销后做新操作，之前的 redo 历史作废
5. **解耦调用者与执行者**：Invoker 不知道 Receiver 是谁
6. **命令日志**：所有操作可追溯，方便调试和回放

## 与策略模式的区别

|          | 命令模式                        | 策略模式               |
| -------- | ------------------------------- | ---------------------- |
| 目的     | 封装"动作"，支持撤销/队列       | 封装"算法"，运行时切换 |
| 状态     | 命令对象通常有状态（undo 信息） | 策略对象通常无状态     |
| 生命周期 | 命令执行一次就完成              | 策略可反复使用         |
| 关注点   | 做了什么、能否撤销              | 怎么做、哪种算法更好   |
