# 🧩 组件设计第 3 轮：高级组合与真实场景

**时间：** 2026-04-29 10:00  
**专项：** 组件设计 · 第 3 轮  
**目标：** 设计 5 个高级可复用组件，聚焦真实业务场景 + 高级模式组合

---

## 与前两轮的区别

| 维度 | 4/20 基础版 | 4/28 进阶版 | 4/29 场景版 |
|------|------------|------------|------------|
| 组件 | Form/List/Modal/Tab/Toast | Select/Table/Tree/Accordion/Dialog | DatePicker/Transfer/Carousel/Steps/Notification |
| 核心 | Props + 状态管理 | Compound/Render Props/HOC/Hook/Portal | 场景驱动 + 模式混合 + 性能优化 |
| 难点 | API 一致性 | 模式深度 | 多模式组合 + 真实约束 |
| 代码量 | ~1200 行 | ~1800 行 | ~2200 行 |

---

## 设计原则 (第 3 轮)

### 1. 场景驱动设计
- 从真实业务场景出发，而非抽象 API
- 每个组件覆盖 3+ 典型使用场景
- 考虑边界情况（空状态/加载/错误/大数据量）

### 2. 模式混合
- 不局限于单一模式
- Compound + Hook + Render Props 组合使用
- 根据场景选择最合适的模式

### 3. 性能优先
- 虚拟滚动/懒加载作为一等公民
- 防抖/节流内置
- 内存泄漏防护

### 4. 无障碍 + 国际化
- ARIA 属性完整
- 键盘导航
- i18n 支持（日期/消息格式化）

---

# 组件 1：DatePicker 日期选择器 (Compound + Hook + Portal)

## 设计理念

DatePicker 是业务中最复杂的表单组件之一。需要处理：
- 日历面板渲染 + 虚拟滚动
- 日期范围选择
- 时间选择混合
- 快捷选项
- 国际化日期格式
- 键盘导航

### 核心特性
- 单日期/日期范围/月份/年份选择
- 时间选择器集成
- 快捷选项面板
- 禁用日期/范围
- 虚拟滚动（多年视图）
- 无障碍键盘导航
- 国际化支持

### API 设计

```typescript
// ============ 类型定义 ============

type DatePickerMode = 'date' | 'week' | 'month' | 'quarter' | 'year';
type DateValue = Date | null;
type DateRange = [Date | null, Date | null] | null;

interface DatePickerSharedProps {
  // 值
  value?: DateValue;
  defaultValue?: DateValue;
  onChange?: (date: DateValue, dateString: string) => void;
  
  // 模式
  mode?: DatePickerMode;
  showTime?: boolean | TimePickerProps;
  
  // 范围
  range?: boolean;
  valueRange?: DateRange;
  defaultValueRange?: DateRange;
  onChangeRange?: (dates: DateRange, dateStrings: [string, string]) => void;
  
  // 约束
  disabledDate?: (date: Date) => boolean;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  
  // 格式
  format?: string | ((date: Date) => string);
  placeholder?: string;
  placeHolderRange?: [string, string];
  
  // 国际化
  locale?: LocaleConfig;
  
  // 自定义
  renderCell?: (date: Date, today: Date) => React.ReactNode;
  renderExtraFooter?: (mode: DatePickerMode) => React.ReactNode;
  className?: string;
  popupClassName?: string;
}

interface DatePickerProps extends DatePickerSharedProps {
  // 输入框
  size?: 'small' | 'middle' | 'large';
  allowClear?: boolean;
  suffixIcon?: React.ReactNode;
  
  // 面板
  defaultPickerValue?: Date;
  onPanelChange?: (date: Date, mode: DatePickerMode) => void;
  
  children?: React.ReactNode;
}

interface RangePickerProps extends DatePickerSharedProps {
  // 范围特有
  separator?: React.ReactNode;
  order?: boolean; // 自动排序
}

// ============ Compound Components ============

interface DatePickerCompound {
  (props: DatePickerProps): React.ReactElement;
  Range: React.FC<RangePickerProps>;
  Panel: React.FC<DatePickerPanelProps>;
}

// ============ Context ============

interface DatePickerContextValue {
  // 核心状态
  mode: DatePickerMode;
  value: DateValue;
  valueRange: DateRange;
  hoverValue: Date | null;
  selectedValue: DateValue;
  
  // 操作
  setMode: (mode: DatePickerMode) => void;
  setValue: (date: DateValue) => void;
  setValueRange: (range: DateRange) => void;
  setHoverValue: (date: Date | null) => void;
  
  // 配置
  disabledDate: ((date: Date) => boolean) | null;
  minDate: Date | null;
  maxDate: Date | null;
  locale: LocaleConfig;
  format: string | ((date: Date) => string);
  showTime: boolean | TimePickerProps | null;
  
  // 面板状态
  sourceDate: Date; // 当前面板显示的月份/年份
  setSourceDate: (date: Date) => void;
}

// ============ 子组件 ============

interface DatePickerPanelProps {
  value?: DateValue;
  onChange?: (date: DateValue) => void;
  mode?: DatePickerMode;
  onModeChange?: (mode: DatePickerMode) => void;
  disabledDate?: (date: Date) => boolean;
  renderCell?: (date: Date, today: Date) => React.ReactNode;
  renderExtraFooter?: (mode: DatePickerMode) => React.ReactNode;
}

interface DatePickerHeaderProps {
  onPrev: () => void;
  onNext: () => void;
  onTitleClick: () => void;
  title: string;
  subTitle?: string;
}

interface DatePickerBodyProps {
  sourceDate: Date;
  mode: DatePickerMode;
  value: DateValue;
  hoverValue: Date | null;
  onSelect: (date: Date) => void;
  onHover: (date: Date) => void;
  onDoubleClick: (date: Date) => void;
  disabledDate: ((date: Date) => boolean) | null;
  renderCell?: (date: Date, today: Date) => React.ReactNode;
}

interface DatePickerShortcutsProps {
  shortcuts: ShortcutItem[];
  onSelect: (date: Date | [Date, Date]) => void;
}

interface ShortcutItem {
  text: React.ReactNode;
  value: Date | ((now: Date) => Date) | [Date, Date] | ((now: Date) => [Date, Date]);
}

// ============ Custom Hook ============

function useDatePicker(props: DatePickerProps) {
  const {
    value,
    defaultValue,
    onChange,
    mode = 'date',
    disabledDate,
    minDate,
    maxDate,
    locale = defaultLocale,
    format: formatStr = 'YYYY-MM-DD',
  } = props;

  // 受控/非受控
  const [innerValue, setInnerValue] = useState<DateValue>(defaultValue ?? null);
  const isControlled = value !== undefined;
  const actualValue = isControlled ? value : innerValue;

  // 面板状态
  const [sourceDate, setSourceDate] = useState<Date>(
    actualValue ?? new Date()
  );
  const [panelMode, setPanelMode] = useState<DatePickerMode>(mode);
  const [hoverValue, setHoverValue] = useState<Date | null>(null);

  // 格式化
  const formatDate = useCallback(
    (date: Date | null): string => {
      if (!date) return '';
      if (typeof formatStr === 'function') return formatStr(date);
      return formatDateToken(date, formatStr, locale);
    },
    [formatStr, locale]
  );

  // 禁用检查
  const isDisabled = useCallback(
    (date: Date): boolean => {
      if (!date) return true;
      if (disabledDate?.(date)) return true;
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    },
    [disabledDate, minDate, maxDate]
  );

  // 面板导航
  const prevPeriod = useCallback(() => {
    setSourceDate(prev => {
      const d = new Date(prev);
      switch (panelMode) {
        case 'date': d.setMonth(d.getMonth() - 1); break;
        case 'month': d.setFullYear(d.getFullYear() - 1); break;
        case 'year': d.setFullYear(d.getFullYear() - 10); break;
        case 'quarter': d.setMonth(d.getMonth() - 3); break;
        case 'week': d.setDate(d.getDate() - 7); break;
      }
      return d;
    });
  }, [panelMode]);

  const nextPeriod = useCallback(() => {
    setSourceDate(prev => {
      const d = new Date(prev);
      switch (panelMode) {
        case 'date': d.setMonth(d.getMonth() + 1); break;
        case 'month': d.setFullYear(d.getFullYear() + 1); break;
        case 'year': d.setFullYear(d.getFullYear() + 10); break;
        case 'quarter': d.setMonth(d.getMonth() + 3); break;
        case 'week': d.setDate(d.getDate() + 7); break;
      }
      return d;
    });
  }, [panelMode]);

  // 模式切换（点击标题升级）
  const handleTitleClick = useCallback(() => {
    const modeOrder: DatePickerMode[] = ['date', 'month', 'year'];
    const idx = modeOrder.indexOf(panelMode);
    if (idx < modeOrder.length - 1) {
      setPanelMode(modeOrder[idx + 1]);
    }
  }, [panelMode]);

  // 选择处理
  const handleSelect = useCallback(
    (date: Date) => {
      if (isDisabled(date)) return;

      if (panelMode === 'date') {
        // 最终选择
        if (!isControlled) setInnerValue(date);
        onChange?.(date, formatDate(date));
        // 如果有 showTime，不关闭面板
      } else {
        // 降级到更细粒度
        const modeOrder: DatePickerMode[] = ['date', 'month', 'year'];
        const idx = modeOrder.indexOf(panelMode);
        if (idx > 0) {
          setPanelMode(modeOrder[idx - 1]);
          setSourceDate(date);
        } else {
          if (!isControlled) setInnerValue(date);
          onChange?.(date, formatDate(date));
        }
      }
    },
    [panelMode, isDisabled, isControlled, onChange, formatDate]
  );

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, date: Date) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate(date, -1, 'day');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavigate(date, 1, 'day');
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleNavigate(date, -7, 'day');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleNavigate(date, 7, 'day');
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleSelect(date);
          break;
        case 'Home':
          e.preventDefault();
          handleNavigate(date, -1, 'monthStart');
          break;
        case 'End':
          e.preventDefault();
          handleNavigate(date, 1, 'monthEnd');
          break;
        case 'PageUp':
          e.preventDefault();
          prevPeriod();
          break;
        case 'PageDown':
          e.preventDefault();
          nextPeriod();
          break;
      }
    },
    [handleSelect, prevPeriod, nextPeriod]
  );

  const handleNavigate = (
    base: Date,
    delta: number,
    unit: 'day' | 'monthStart' | 'monthEnd'
  ) => {
    let target: Date;
    if (unit === 'monthStart') {
      target = new Date(base.getFullYear(), base.getMonth(), 1);
    } else if (unit === 'monthEnd') {
      target = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    } else {
      target = new Date(base);
      target.setDate(target.getDate() + delta);
    }
    if (!isDisabled(target)) {
      setHoverValue(target);
    }
  };

  return {
    // 状态
    value: actualValue,
    sourceDate,
    panelMode,
    hoverValue,
    isDisabled,
    // 操作
    handleSelect,
    handleKeyDown,
    setHoverValue,
    setSourceDate,
    setPanelMode,
    prevPeriod,
    nextPeriod,
    handleTitleClick,
    // 工具
    formatDate,
    locale,
  };
}

// ============ 日期格式化工具 ============

function formatDateToken(date: Date, format: string, locale: LocaleConfig): string {
  const tokens: Record<string, () => string> = {
    YYYY: () => String(date.getFullYear()),
    YY: () => String(date.getFullYear()).slice(-2),
    MM: () => String(date.getMonth() + 1).padStart(2, '0'),
    M: () => String(date.getMonth() + 1),
    DD: () => String(date.getDate()).padStart(2, '0'),
    D: () => String(date.getDate()),
    HH: () => String(date.getHours()).padStart(2, '0'),
    H: () => String(date.getHours()),
    mm: () => String(date.getMinutes()).padStart(2, '0'),
    m: () => String(date.getMinutes()),
    ss: () => String(date.getSeconds()).padStart(2, '0'),
    s: () => String(date.getSeconds()),
    WW: () => locale.weekdays[date.getDay()],
    W: () => locale.shortWeekdays?.[date.getDay()] ?? locale.weekdays[date.getDay()][0],
  };

  return format.replace(
    /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s|WW|W/g,
    match => tokens[match]?.() ?? match
  );
}

// ============ 组件实现 ============

const DatePicker: DatePickerCompound = (props) => {
  const {
    value,
    defaultValue,
    onChange,
    mode = 'date',
    showTime,
    disabled,
    format,
    placeholder = '请选择日期',
    size = 'middle',
    allowClear = true,
    suffixIcon,
    popupClassName,
    renderExtraFooter,
    children,
    ...rest
  } = props;

  const picker = useDatePicker(props);
  const [opened, setOpened] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Portal 渲染面板
  const popupElement = opened ? (
    <DatePickerPopup
      ref={popupRef}
      picker={picker}
      showTime={showTime}
      renderExtraFooter={renderExtraFooter}
      popupClassName={popupClassName}
      onClose={() => setOpened(false)}
    />
  ) : null;

  return (
    <div ref={containerRef} className="date-picker" style={{ position: 'relative' }}>
      {/* 输入框 */}
      <input
        type="text"
        value={picker.formatDate(picker.value)}
        placeholder={placeholder}
        disabled={disabled}
        size={size}
        readOnly={!showTime}
        onClick={() => !disabled && setOpened(true)}
        onFocus={() => !disabled && setOpened(true)}
        aria-haspopup="dialog"
        aria-expanded={opened}
      />
      {/* 清除按钮 */}
      {allowClear && picker.value && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!picker.isControlled) {
              // handled by useDatePicker
            }
            onChange?.(null, '');
          }}
          aria-label="清除"
        >
          ×
        </button>
      )}
      {/* Portal 面板 */}
      {popupElement && createPortal(popupElement, document.body)}
    </div>
  );
};

// Range 组件
const RangePicker: React.FC<RangePickerProps> = (props) => {
  const {
    valueRange,
    defaultValueRange,
    onChangeRange,
    separator = '~',
    order = true,
    ...rest
  } = props;

  const [innerRange, setInnerRange] = useState<DateRange>(defaultValueRange ?? null);
  const isControlled = valueRange !== undefined;
  const actualRange = isControlled ? valueRange : innerRange;
  const [focusedIndex, setFocusedIndex] = useState<0 | 1>(0);
  const [opened, setOpened] = useState(false);

  // 范围选择状态机
  const [pendingStart, setPendingStart] = useState<Date | null>(null);

  const handleChange = useCallback(
    (date: Date) => {
      if (!pendingStart) {
        // 第一次选择：设为起始
        setPendingStart(date);
        setFocusedIndex(1);
      } else {
        // 第二次选择：完成范围
        let start = pendingStart;
        let end = date;
        if (order && start > end) [start, end] = [end, start];
        const newRange: DateRange = [start, end];
        if (!isControlled) setInnerRange(newRange);
        onChangeRange?.(newRange, [
          formatDateToken(start, 'YYYY-MM-DD', defaultLocale),
          formatDateToken(end, 'YYYY-MM-DD', defaultLocale),
        ]);
        setPendingStart(null);
        setOpened(false);
      }
    },
    [pendingStart, order, isControlled, onChangeRange]
  );

  // 判断日期是否在范围内（高亮）
  const isInRange = useCallback(
    (date: Date): boolean => {
      if (!actualRange) return false;
      if (pendingStart) {
        const s = pendingStart < date ? pendingStart : date;
        const e = pendingStart > date ? pendingStart : date;
        return date >= s && date <= e;
      }
      return date >= actualRange[0]! && date <= actualRange[1]!;
    },
    [actualRange, pendingStart]
  );

  return (
    <div className="range-picker">
      <input
        value={actualRange?.[0] ? formatDateToken(actualRange[0], 'YYYY-MM-DD', defaultLocale) : ''}
        placeholder="开始日期"
        onFocus={() => { setFocusedIndex(0); setOpened(true); }}
        readOnly
      />
      <span className="separator">{separator}</span>
      <input
        value={actualRange?.[1] ? formatDateToken(actualRange[1], 'YYYY-MM-DD', defaultLocale) : ''}
        placeholder="结束日期"
        onFocus={() => { setFocusedIndex(1); setOpened(true); }}
        readOnly
      />
      {opened && createPortal(
        <RangePickerPopup
          range={actualRange}
          pendingStart={pendingStart}
          focusedIndex={focusedIndex}
          onSelect={handleChange}
          isInRange={isInRange}
          onClose={() => { setOpened(false); setPendingStart(null); }}
        />,
        document.body
      )}
    </div>
  );
};

DatePicker.Range = RangePicker;
DatePicker.Panel = (props: DatePickerPanelProps) => {
  const picker = useDatePicker({ ...props, value: props.value } as DatePickerProps);
  return <DatePickerPopup picker={picker} standalone />;
};

// ============ 使用示例 ============

/**
 * 示例 1: 基础单日期选择
 */
function Example1() {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <DatePicker
      value={date}
      onChange={setDate}
      placeholder="请选择日期"
    />
  );
}

/**
 * 示例 2: 日期范围选择
 */
function Example2() {
  const [range, setRange] = useState<DateRange>(null);
  return (
    <DatePicker.Range
      valueRange={range}
      onChangeRange={setRange}
      separator="至"
    />
  );
}

/**
 * 示例 3: 带时间选择 + 禁用日期
 */
function Example3() {
  return (
    <DatePicker
      showTime={{ format: 'HH:mm' }}
      format="YYYY-MM-DD HH:mm"
      disabledDate={(date) => {
        // 禁用过去日期和周末
        return date < new Date().setHours(0, 0, 0, 0) || date.getDay() === 0 || date.getDay() === 6;
      }}
      renderExtraFooter={() => (
        <button onClick={() => alert('今天')}>今天</button>
      )}
    />
  );
}

/**
 * 示例 4: 月份选择
 */
function Example4() {
  return (
    <DatePicker
      mode="month"
      format="YYYY-MM"
      placeholder="请选择月份"
    />
  );
}

/**
 * 示例 5: 自定义渲染 + 快捷选项
 */
function Example5() {
  return (
    <DatePicker
      renderCell={(date, today) => {
        const isToday = date.toDateString() === today.toDateString();
        return (
          <div className={isToday ? 'today-cell' : ''}>
            {date.getDate()}
            {isToday && <span className="dot" />}
          </div>
        );
      }}
      renderExtraFooter={(mode) => (
        <DatePickerShortcuts
          shortcuts={[
            { text: '今天', value: new Date() },
            { text: '昨天', value: (now) => { const d = new Date(now); d.setDate(d.getDate() - 1); return d; } },
            { text: '本周', value: (now) => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d; } },
            { text: '本月', value: (now) => new Date(now.getFullYear(), now.getMonth(), 1) },
          ]}
          onSelect={(date) => console.log('shortcut select', date)}
        />
      )}
    />
  );
}
```

---

# 组件 2：Transfer 穿梭框 (Compound + Virtual Scroll)

## 设计理念

穿梭框用于从大量选项中选择多个项目。核心挑战：
- 大数据量（万级）的渲染性能
- 搜索过滤 + 实时高亮
- 批量操作
- 拖拽排序
- 左右面板的同步状态

### 核心特性
- 虚拟滚动（左右列表）
- 搜索过滤
- 批量选择/移动
- 拖拽排序
- 自定义渲染
- 分页模式（替代虚拟滚动）
- 无障碍

### API 设计

```typescript
// ============ 类型定义 ============

interface TransferItem {
  key: string | number;
  title?: string;
  disabled?: boolean;
  checked?: boolean; // 预选项
  [key: string]: any;
}

interface TransferProps {
  // 数据
  dataSource: TransferItem[];
  targetKeys?: string[];
  defaultTargetKeys?: string[];
  onChange?: (targetKeys: string[], direction: 'left' | 'right', movedItems: TransferItem[]) => void;
  
  // 标题
  titles?: [string, string];
  
  // 搜索
  searchable?: boolean;
  filterOption?: (inputValue: string, item: TransferItem) => boolean;
  onSearch?: (direction: 'left' | 'right', keyword: string) => void;
  
  // 渲染
  render?: (item: TransferItem) => React.ReactNode;
  footer?: React.ReactNode | ((props: TransferFooterProps) => React.ReactNode);
  
  // 操作
  operations?: string[]; // 按钮文案 ['>', '<', '>>', '<<']
  showSelectAll?: boolean;
  
  // 性能
  virtual?: boolean;
  itemHeight?: number;
  listHeight?: number;
  
  // 拖拽
  draggable?: boolean;
  onDragEnd?: (info: TransferDragInfo) => void;
  
  // 样式
  className?: string;
  listClassName?: string;
  disabled?: boolean;
  oneWay?: boolean; // 单向模式
  lazy?: boolean; // 懒加载模式
}

interface TransferFooterProps {
  selectedCount: number;
  totalCount: number;
}

interface TransferDragInfo {
  direction: 'left' | 'right';
  sourceIndex: number;
  targetIndex: number;
  item: TransferItem;
}

// ============ Compound Components ============

interface TransferCompound {
  (props: TransferProps): React.ReactElement;
  Item: React.FC<{ item: TransferItem; render?: (item: TransferItem) => React.ReactNode }>;
}

// ============ Context ============

interface TransferContextValue {
  // 数据
  leftItems: TransferItem[];
  rightItems: TransferItem[];
  leftSelected: Set<string | number>;
  rightSelected: Set<string | number>;
  
  // 搜索
  leftSearch: string;
  rightSearch: string;
  
  // 操作
  moveRight: (keys?: (string | number)[]) => void;
  moveLeft: (keys?: (string | number)[]) => void;
  toggleLeftSelect: (key: string | number) => void;
  toggleRightSelect: (key: string | number) => void;
  selectAllLeft: () => void;
  selectAllRight: () => void;
  
  // 配置
  disabled: boolean;
  render?: (item: TransferItem) => React.ReactNode;
  oneWay: boolean;
}

// ============ Custom Hook ============

function useTransfer(props: TransferProps) {
  const {
    dataSource,
    targetKeys: propTargetKeys,
    defaultTargetKeys = [],
    onChange,
    filterOption,
    disabled = false,
    oneWay = false,
  } = props;

  // 受控/非受控
  const [innerTargetKeys, setInnerTargetKeys] = useState<string[]>(defaultTargetKeys);
  const isControlled = propTargetKeys !== undefined;
  const targetKeys = isControlled ? propTargetKeys : innerTargetKeys;

  // 搜索
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');

  // 选中
  const [leftSelected, setLeftSelected] = useState<Set<string | number>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<string | number>>(new Set());

  // 分割数据
  const targetKeySet = new Set(targetKeys);
  const leftItems = dataSource.filter(item => !targetKeySet.has(String(item.key)));
  const rightItems = dataSource.filter(item => targetKeySet.has(String(item.key)));

  // 过滤
  const filteredLeft = useMemo(() => {
    if (!leftSearch) return leftItems;
    return leftItems.filter(item =>
      filterOption
        ? filterOption(leftSearch, item)
        : item.title?.toLowerCase().includes(leftSearch.toLowerCase())
          || String(item.key).includes(leftSearch)
    );
  }, [leftItems, leftSearch, filterOption]);

  const filteredRight = useMemo(() => {
    if (!rightSearch) return rightItems;
    return rightItems.filter(item =>
      filterOption
        ? filterOption(rightSearch, item)
        : item.title?.toLowerCase().includes(rightSearch.toLowerCase())
          || String(item.key).includes(rightSearch)
    );
  }, [rightItems, rightSearch, filterOption]);

  // 移动操作
  const moveRight = useCallback(
    (keys?: (string | number)[]) => {
      const keysToMove = keys ?? Array.from(leftSelected);
      if (keysToMove.length === 0) return;
      const movedItems = leftItems.filter(item => keysToMove.includes(item.key));
      const newTargetKeys = [...targetKeys, ...keysToMove.map(String)];
      if (!isControlled) setInnerTargetKeys(newTargetKeys);
      setLeftSelected(new Set());
      onChange?.(newTargetKeys, 'right', movedItems);
    },
    [leftSelected, leftItems, targetKeys, isControlled, onChange]
  );

  const moveLeft = useCallback(
    (keys?: (string | number)[]) => {
      if (oneWay) return;
      const keysToMove = keys ?? Array.from(rightSelected);
      if (keysToMove.length === 0) return;
      const movedItems = rightItems.filter(item => keysToMove.includes(item.key));
      const newTargetKeys = targetKeys.filter(k => !keysToMove.includes(k));
      if (!isControlled) setInnerTargetKeys(newTargetKeys);
      setRightSelected(new Set());
      onChange?.(newTargetKeys, 'left', movedItems);
    },
    [rightSelected, rightItems, targetKeys, isControlled, onChange, oneWay]
  );

  // 全选逻辑
  const selectAllLeft = useCallback(() => {
    const availableKeys = filteredLeft.filter(i => !i.disabled).map(i => i.key);
    setLeftSelected(prev => {
      const isAllSelected = availableKeys.every(k => prev.has(k));
      if (isAllSelected) return new Set();
      return new Set([...prev, ...availableKeys]);
    });
  }, [filteredLeft]);

  const selectAllRight = useCallback(() => {
    const availableKeys = filteredRight.filter(i => !i.disabled).map(i => i.key);
    setRightSelected(prev => {
      const isAllSelected = availableKeys.every(k => prev.has(k));
      if (isAllSelected) return new Set();
      return new Set([...prev, ...availableKeys]);
    });
  }, [filteredRight]);

  return {
    // 数据
    leftItems: filteredLeft,
    rightItems: filteredRight,
    leftSelected,
    rightSelected,
    leftSearch,
    rightSearch,
    // 操作
    moveRight,
    moveLeft,
    setLeftSearch,
    setRightSearch,
    toggleLeftSelect: (key: string | number) =>
      setLeftSelected(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      }),
    toggleRightSelect: (key: string | number) =>
      setRightSelected(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      }),
    selectAllLeft,
    selectAllRight,
    // 配置
    disabled,
    oneWay,
  };
}

// ============ 虚拟滚动列表 ============

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

function VirtualList<T>({ items, itemHeight, containerHeight, renderItem, onScroll }: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIdx = Math.floor(offset / itemHeight);
  const endIdx = Math.min(startIdx + visibleCount + 2, items.length); // +2 buffer
  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startIdx * itemHeight;

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setOffset(e.currentTarget.scrollTop);
      onScroll?.(e);
    },
    [onScroll]
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: containerHeight, overflow: 'auto', position: 'relative' }}
      role="listbox"
      aria-multiselectable="true"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: offsetY + idx * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(item, startIdx + idx)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ 组件实现 ============

const Transfer: TransferCompound = (props) => {
  const {
    titles = ['源列表', '目标列表'],
    searchable = false,
    render,
    operations = ['>', '<', '>>', '<<'],
    showSelectAll = true,
    virtual = true,
    itemHeight = 32,
    listHeight = 250,
    footer,
    className,
    listClassName,
    draggable = false,
    className: cls,
    ...rest
  } = props;

  const transfer = useTransfer(props);

  // 渲染列表项
  const renderItem = useCallback(
    (item: TransferItem, side: 'left' | 'right') => {
      const selected = side === 'left'
        ? transfer.leftSelected.has(item.key)
        : transfer.rightSelected.has(item.key);
      const disabled = item.disabled || props.disabled;

      return (
        <div
          className={`transfer-item ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={() => {
            if (disabled) return;
            side === 'left'
              ? transfer.toggleLeftSelect(item.key)
              : transfer.toggleRightSelect(item.key);
          }}
          role="option"
          aria-selected={selected}
          draggable={draggable && !disabled}
          onDragStart={(e) => {
            if (draggable) {
              e.dataTransfer.setData('text/plain', String(item.key));
            }
          }}
        >
          {showSelectAll && <input type="checkbox" checked={selected} disabled={disabled} />}
          <span className="item-title">
            {render ? render(item) : (item.title ?? item.key)}
          </span>
        </div>
      );
    },
    [transfer, render, props.disabled, draggable, showSelectAll]
  );

  return (
    <div className={`transfer ${cls ?? ''}`}>
      {/* 左侧面板 */}
      <div className={`transfer-panel ${listClassName}`}>
        <div className="transfer-header">
          <span>{titles[0]}</span>
          {showSelectAll && (
            <button onClick={transfer.selectAllLeft} disabled={props.disabled}>
              全选
            </button>
          )}
        </div>
        {searchable && (
          <input
            className="transfer-search"
            placeholder="搜索"
            value={transfer.leftSearch}
            onChange={(e) => transfer.setLeftSearch(e.target.value)}
          />
        )}
        <div className="transfer-body">
          {virtual ? (
            <VirtualList
              items={transfer.leftItems}
              itemHeight={itemHeight}
              containerHeight={listHeight}
              renderItem={(item, idx) => renderItem(item, 'left')}
            />
          ) : (
            transfer.leftItems.map((item) => renderItem(item, 'left'))
          )}
        </div>
        {footer && (
          <div className="transfer-footer">
            {typeof footer === 'function'
              ? footer({ selectedCount: transfer.leftSelected.size, totalCount: transfer.leftItems.length })
              : footer}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="transfer-operations">
        <button onClick={() => transfer.moveRight()} disabled={transfer.leftSelected.size === 0 || props.disabled}>
          {operations[0]}
        </button>
        {!props.oneWay && (
          <button onClick={() => transfer.moveLeft()} disabled={transfer.rightSelected.size === 0 || props.disabled}>
            {operations[1]}
          </button>
        )}
        <button
          onClick={() => transfer.moveRight(transfer.leftItems.map(i => i.key))}
          disabled={transfer.leftItems.length === 0 || props.disabled}
        >
          {operations[2]}
        </button>
        {!props.oneWay && (
          <button
            onClick={() => transfer.moveLeft(transfer.rightItems.map(i => i.key))}
            disabled={transfer.rightItems.length === 0 || props.disabled}
          >
            {operations[3]}
          </button>
        )}
      </div>

      {/* 右侧面板 */}
      <div className={`transfer-panel ${listClassName}`}>
        <div className="transfer-header">
          <span>{titles[1]}</span>
          {showSelectAll && (
            <button onClick={transfer.selectAllRight} disabled={props.disabled}>
              全选
            </button>
          )}
        </div>
        {searchable && (
          <input
            className="transfer-search"
            placeholder="搜索"
            value={transfer.rightSearch}
            onChange={(e) => transfer.setRightSearch(e.target.value)}
          />
        )}
        <div className="transfer-body">
          {virtual ? (
            <VirtualList
              items={transfer.rightItems}
              itemHeight={itemHeight}
              containerHeight={listHeight}
              renderItem={(item, idx) => renderItem(item, 'right')}
            />
          ) : (
            transfer.rightItems.map((item) => renderItem(item, 'right'))
          )}
        </div>
        {footer && (
          <div className="transfer-footer">
            {typeof footer === 'function'
              ? footer({ selectedCount: transfer.rightSelected.size, totalCount: transfer.rightItems.length })
              : footer}
          </div>
        )}
      </div>
    </div>
  );
};

Transfer.Item = ({ item, render }) => (
  <div>{render ? render(item) : (item.title ?? item.key)}</div>
);

// ============ 使用示例 ============

/**
 * 示例 1: 基础穿梭框
 */
function Example1() {
  const [keys, setKeys] = useState<string[]>([]);
  const mockData: TransferItem[] = Array.from({ length: 50 }, (_, i) => ({
    key: `item-${i}`,
    title: `选项 ${i + 1}`,
  }));

  return (
    <Transfer
      dataSource={mockData}
      targetKeys={keys}
      onChange={setKeys}
      titles={['可选', '已选']}
    />
  );
}

/**
 * 示例 2: 可搜索 + 自定义渲染 + 大数据量
 */
function Example2() {
  const [keys, setKeys] = useState<string[]>([]);
  // 10000 条数据
  const largeData: TransferItem[] = Array.from({ length: 10000 }, (_, i) => ({
    key: `user-${i}`,
    title: `用户 ${i + 1}`,
    avatar: `/avatars/${i}.png`,
  }));

  return (
    <Transfer
      dataSource={largeData}
      targetKeys={keys}
      onChange={setKeys}
      searchable
      virtual
      listHeight={400}
      titles={['全部用户', '已分配用户']}
      render={(item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={item.avatar} width={24} height={24} />
          <span>{item.title}</span>
        </div>
      )}
      filterOption={(input, item) =>
        item.title?.toLowerCase().includes(input.toLowerCase())
        || String(item.key).includes(input)
      }
      footer={({ selectedCount, totalCount }) => (
        <span>已选 {selectedCount} / {totalCount}</span>
      )}
    />
  );
}

/**
 * 示例 3: 单向模式（只允许移入）
 */
function Example3() {
  return (
    <Transfer
      dataSource={[
        { key: 'a', title: 'A' },
        { key: 'b', title: 'B' },
        { key: 'c', title: 'C', disabled: true },
      ]}
      oneWay
      operations={['添加']}
    />
  );
}

/**
 * 示例 4: 拖拽排序
 */
function Example4() {
  const [keys, setKeys] = useState<string[]>([]);
  return (
    <Transfer
      dataSource={Array.from({ length: 20 }, (_, i) => ({
        key: `task-${i}`,
        title: `任务 ${i + 1}`,
      }))}
      targetKeys={keys}
      onChange={setKeys}
      draggable
      onDragEnd={(info) => {
        console.log(`拖拽: ${info.direction}, ${info.sourceIndex} → ${info.targetIndex}`);
      }}
    />
  );
}
```

---

# 组件 3：Carousel 轮播图 (Hook + Compound + 手势)

## 设计理念

轮播图看似简单，但要做好需要考虑：
- 触摸/鼠标拖拽手势
- 自动播放 + 暂停策略
- 无缝循环
- 响应式（显示数量自适应）
- 动画性能（transform + will-change）
- 键盘导航 + 无障碍

### 核心特性
- 触摸/鼠标拖拽
- 自动播放（可暂停）
- 无缝循环（clone 首尾）
- 响应式列数
- 多种动画效果（slide/fade/zoom）
- 自定义指示器
- 键盘导航
- 懒加载图片

### API 设计

```typescript
// ============ 类型定义 ============

type CarouselEffect = 'slide' | 'fade' | 'zoom';

interface CarouselProps {
  // 内容
  children: React.ReactNode;
  
  // 行为
  autoplay?: boolean;
  autoplayInterval?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  speed?: number; // 动画时长 ms
  
  // 导航
  dots?: boolean | 'numbers' | React.FC<DotProps>;
  arrows?: boolean;
  prevArrow?: React.ReactNode;
  nextArrow?: React.ReactNode;
  
  // 布局
  effect?: CarouselEffect;
  slidesToShow?: number;
  slidesToScroll?: number;
  responsive?: ResponsiveConfig[];
  centerMode?: boolean;
  centerPadding?: string;
  
  // 手势
  swipe?: boolean;
  swipeThreshold?: number;
  vertical?: boolean;
  
  // 事件
  beforeChange?: (current: number, next: number) => void;
  afterChange?: (current: number) => void;
  
  // 受控
  current?: number;
  defaultCurrent?: number;
  onChange?: (index: number) => void;
  
  // 样式
  className?: string;
}

interface ResponsiveConfig {
  breakpoint: number;
  settings: Partial<CarouselProps>;
}

interface DotProps {
  count: number;
  current: number;
  onClick: (index: number) => void;
}

// ============ Custom Hook ============

function useCarousel(props: CarouselProps) {
  const {
    children,
    autoplay = false,
    autoplayInterval = 3000,
    pauseOnHover = true,
    loop = true,
    speed = 300,
    slidesToShow = 1,
    slidesToScroll = 1,
    effect = 'slide',
    vertical = false,
    current: propCurrent,
    defaultCurrent = 0,
    onChange,
    beforeChange,
    afterChange,
    responsive,
  } = props;

  const childArray = React.Children.toArray(children);
  const realCount = childArray.length;

  // 响应式计算
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [currentSlidesToShow, setCurrentSlidesToShow] = useState(slidesToShow);

  useEffect(() => {
    if (!responsive?.length) return;
    const handler = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      const match = responsive
        .filter(r => w <= r.breakpoint)
        .sort((a, b) => b.breakpoint - a.breakpoint)[0];
      if (match?.settings.slidesToShow) {
        setCurrentSlidesToShow(match.settings.slidesToShow);
      }
    };
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [responsive, slidesToShow]);

  // 最大索引
  const maxIndex = Math.max(0, realCount - currentSlidesToShow);

  // 受控/非受控
  const [innerCurrent, setInnerCurrent] = useState(defaultCurrent);
  const isControlled = propCurrent !== undefined;
  const actualCurrent = isControlled ? propCurrent : innerCurrent;

  // 动画状态
  const [animating, setAnimating] = useState(false);
  const [targetIndex, setTargetIndex] = useState(actualCurrent);

  // 自动播放
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    if (!autoplay || paused) return;
    timerRef.current = setInterval(() => {
      goTo(actualCurrent >= maxIndex ? (loop ? 0 : maxIndex) : actualCurrent + slidesToScroll);
    }, autoplayInterval);
  }, [autoplay, paused, actualCurrent, maxIndex, loop, slidesToScroll, autoplayInterval]);

  const stopAutoplay = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
  }, [startAutoplay, stopAutoplay]);

  // 导航
  const goTo = useCallback(
    (index: number, isDrag?: boolean) => {
      if (animating && !isDrag) return;
      
      let nextIndex = index;
      if (loop) {
        // 无缝循环：超出范围时先跳到 clone，再瞬间跳回
        if (index < 0) nextIndex = maxIndex;
        else if (index > maxIndex) nextIndex = 0;
      } else {
        nextIndex = Math.max(0, Math.min(index, maxIndex));
      }

      if (nextIndex === actualCurrent && !loop) return;

      beforeChange?.(actualCurrent, nextIndex);

      if (!isControlled) setInnerCurrent(nextIndex);
      onChange?.(nextIndex);

      setTargetIndex(nextIndex);
      setAnimating(true);

      setTimeout(() => {
        setAnimating(false);
        afterChange?.(nextIndex);

        // 无缝循环的瞬间跳转
        if (loop && (nextIndex === 0 && index > maxIndex)) {
          // 通过 ref 直接设置 transition 为 0，瞬间跳到真实 0
        }
        if (loop && (nextIndex === maxIndex && index < 0)) {
          // 瞬间跳到真实 maxIndex
        }
      }, speed);
    },
    [actualCurrent, maxIndex, loop, animating, isControlled, onChange, beforeChange, afterChange, speed]
  );

  const next = useCallback(() => goTo(actualCurrent + slidesToScroll), [goTo, actualCurrent, slidesToScroll]);
  const prev = useCallback(() => goTo(actualCurrent - slidesToScroll), [goTo, actualCurrent, slidesToScroll]);

  // 手势
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartRef = useRef({ x: 0, y: 0, current: 0 });

  const handleDragStart = useCallback(
    (clientX: number, clientY: number) => {
      stopAutoplay();
      setDragging(true);
      setDragOffset(0);
      dragStartRef.current = { x: clientX, y: clientY, current: actualCurrent };
    },
    [actualCurrent, stopAutoplay]
  );

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      const delta = vertical ? dy : dx;
      setDragOffset(delta);
    },
    [dragging, vertical]
  );

  const handleDragEnd = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging) return;
      setDragging(false);
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      const delta = vertical ? dy : dx;
      const threshold = props.swipeThreshold ?? 50;

      if (Math.abs(delta) > threshold) {
        if (delta > 0) prev();
        else next();
      }

      setDragOffset(0);
      startAutoplay();
    },
    [dragging, vertical, prev, next, props.swipeThreshold, startAutoplay]
  );

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prev();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          next();
          break;
        case 'Home':
          e.preventDefault();
          goTo(0);
          break;
        case 'End':
          e.preventDefault();
          goTo(maxIndex);
          break;
      }
    },
    [prev, next, goTo, maxIndex]
  );

  // 计算偏移
  const getTransform = useCallback(() => {
    const slideWidth = 100 / currentSlidesToShow;
    const baseOffset = -(targetIndex * slideWidth);
    const dragOffsetPercent = vertical ? 0 : (dragOffset / (dragOffset > 0 ? 1 : -1)) * 0.01;
    
    if (effect === 'fade' || effect === 'zoom') {
      return { opacity: 1, transform: '' };
    }
    
    return {
      transform: vertical
        ? `translateY(${baseOffset + dragOffset}px)`
        : `translateX(${baseOffset}% + ${dragOffset}px)`,
    };
  }, [targetIndex, currentSlidesToShow, dragOffset, vertical, effect]);

  return {
    // 状态
    actualCurrent,
    animating,
    dragging,
    dragOffset,
    realCount,
    maxIndex,
    currentSlidesToShow,
    // 操作
    goTo,
    next,
    prev,
    // 手势
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    // 自动播放
    paused,
    setPaused,
    // 键盘
    handleKeyDown,
    // 样式
    getTransform,
    speed,
    effect,
    loop,
    centerMode: props.centerMode,
    centerPadding: props.centerPadding,
  };
}

// ============ 组件实现 ============

const Carousel: React.FC<CarouselProps> = (props) => {
  const {
    children,
    dots = true,
    arrows = true,
    prevArrow,
    nextArrow,
    swipe = true,
    pauseOnHover = true,
    className,
    vertical = false,
    ...rest
  } = props;

  const carousel = useCarousel({ ...props, children });
  const trackRef = useRef<HTMLDivElement>(null);
  const childArray = React.Children.toArray(children);

  // 克隆首尾实现无缝循环
  const slides = carousel.loop
    ? [
        childArray[childArray.length - 1],
        ...childArray,
        childArray[0],
      ]
    : childArray;

  // 鼠标/触摸事件
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!swipe) return;
      carousel.handleDragStart(e.clientX, e.clientY);
    },
    [swipe, carousel.handleDragStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!swipe) return;
      carousel.handleDragMove(e.clientX, e.clientY);
    },
    [swipe, carousel.handleDragMove]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!swipe) return;
      carousel.handleDragEnd(e.clientX, e.clientY);
    },
    [swipe, carousel.handleDragEnd]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!swipe) return;
      carousel.handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    },
    [swipe, carousel.handleDragStart]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swipe) return;
      carousel.handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    [swipe, carousel.handleDragMove]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!swipe) return;
      const touch = e.changedTouches[0];
      carousel.handleDragEnd(touch.clientX, touch.clientY);
    },
    [swipe, carousel.handleDragEnd]
  );

  const style = carousel.getTransform();

  return (
    <div
      className={`carousel ${className ?? ''}`}
      onMouseEnter={() => pauseOnHover && carousel.setPaused(true)}
      onMouseLeave={() => { pauseOnHover && carousel.setPaused(false); carousel.startAutoplay?.(); }}
      onKeyDown={carousel.handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="轮播图"
      aria-roledescription="carousel"
    >
      {/* 轨道 */}
      <div
        ref={trackRef}
        className="carousel-track"
        style={{
          transition: carousel.animating || carousel.dragging
            ? `transform ${carousel.speed}ms ease`
            : 'none',
          ...(vertical
            ? { display: 'block' }
            : { display: 'flex', flexDirection: 'row' }),
          ...style,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((child, index) => {
          const isActive = carousel.loop
            ? index === carousel.actualCurrent + 1
            : index === carousel.actualCurrent;
          const isVisible = carousel.loop
            ? Math.abs(index - (carousel.actualCurrent + 1)) <= 1
            : Math.abs(index - carousel.actualCurrent) < carousel.currentSlidesToShow;

          return (
            <div
              key={index}
              className={`carousel-slide ${isActive ? 'active' : ''}`}
              style={{
                flex: `0 0 ${100 / carousel.currentSlidesToShow}%`,
                transition: carousel.effect === 'fade'
                  ? `opacity ${carousel.speed}ms ease`
                  : undefined,
                opacity: carousel.effect === 'fade'
                  ? isActive ? 1 : 0
                  : undefined,
                willChange: 'transform, opacity',
              }}
              aria-roledescription="slide"
              aria-label={`${index + 1} / ${carousel.realCount}`}
              aria-hidden={!isVisible}
            >
              {child}
            </div>
          );
        })}
      </div>

      {/* 箭头 */}
      {arrows && (
        <>
          <button
            className="carousel-arrow carousel-arrow-prev"
            onClick={carousel.prev}
            disabled={!carousel.loop && carousel.actualCurrent === 0}
            aria-label="上一张"
          >
            {prevArrow || '‹'}
          </button>
          <button
            className="carousel-arrow carousel-arrow-next"
            onClick={carousel.next}
            disabled={!carousel.loop && carousel.actualCurrent >= carousel.maxIndex}
            aria-label="下一张"
          >
            {nextArrow || '›'}
          </button>
        </>
      )}

      {/* 指示器 */}
      {dots && (
        <div className="carousel-dots" role="tablist">
          {typeof dots === 'function' ? (
            dots({
              count: carousel.realCount,
              current: carousel.actualCurrent,
              onClick: carousel.goTo,
            })
          ) : dots === 'numbers' ? (
            Array.from({ length: carousel.realCount }, (_, i) => (
              <button
                key={i}
                className={`carousel-dot ${i === carousel.actualCurrent ? 'active' : ''}`}
                onClick={() => carousel.goTo(i)}
                role="tab"
                aria-selected={i === carousel.actualCurrent}
                aria-label={`第 ${i + 1} 张`}
              >
                {i + 1}
              </button>
            ))
          ) : (
            Array.from({ length: carousel.realCount }, (_, i) => (
              <button
                key={i}
                className={`carousel-dot ${i === carousel.actualCurrent ? 'active' : ''}`}
                onClick={() => carousel.goTo(i)}
                role="tab"
                aria-selected={i === carousel.actualCurrent}
                aria-label={`第 ${i + 1} 张`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ============ 使用示例 ============

/**
 * 示例 1: 基础轮播
 */
function Example1() {
  return (
    <Carousel autoplay autoplayInterval={4000}>
      <div className="slide"><img src="/banner1.jpg" /></div>
      <div className="slide"><img src="/banner2.jpg" /></div>
      <div className="slide"><img src="/banner3.jpg" /></div>
    </Carousel>
  );
}

/**
 * 示例 2: 多列响应式
 */
function Example2() {
  return (
    <Carousel
      slidesToShow={3}
      slidesToScroll={1}
      responsive={[
        { breakpoint: 768, settings: { slidesToShow: 2 } },
        { breakpoint: 480, settings: { slidesToShow: 1 } },
      ]}
      centerMode
      centerPadding="20px"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="card">卡片 {i + 1}</div>
      ))}
    </Carousel>
  );
}

/**
 * 示例 3: 淡入淡出效果 + 数字指示器
 */
function Example3() {
  return (
    <Carousel
      effect="fade"
      speed={500}
      dots="numbers"
      autoplay
      pauseOnHover
    >
      <div className="slide" style={{ background: '#f00', height: 400 }}>红</div>
      <div className="slide" style={{ background: '#0f0', height: 400 }}>绿</div>
      <div className="slide" style={{ background: '#00f', height: 400 }}>蓝</div>
    </Carousel>
  );
}

/**
 * 示例 4: 自定义指示器
 */
function Example4() {
  return (
    <Carousel
      dots={({ count, current, onClick }) => (
        <div className="custom-dots">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className={`dot ${i === current ? 'active' : ''}`}
              onClick={() => onClick(i)}
            />
          ))}
          <span className="counter">{current + 1} / {count}</span>
        </div>
      )}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="slide">Slide {i + 1}</div>
      ))}
    </Carousel>
  );
}

/**
 * 示例 5: 垂直轮播
 */
function Example5() {
  return (
    <Carousel
      vertical
      autoplay
      autoplayInterval={2000}
      dots={false}
      arrows
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="slide" style={{ height: 200 }}>
          垂直内容 {i + 1}
        </div>
      ))}
    </Carousel>
  );
}
```

---

# 组件 4：Steps 步骤条 (Compound + Context)

## 设计理念

步骤条用于引导用户完成多步骤流程。核心挑战：
- 多种布局（水平/垂直/迷你）
- 状态管理（等待/进行中/完成/错误）
- 可点击导航
- 响应式（窄屏自动切换）
- 与表单集成

### 核心特性
- 水平/垂直/迷你布局
- 步骤状态（wait/process/finish/error）
- 可点击切换
- 进度条模式
- 响应式自适应
- 自定义图标
- 子步骤

### API 设计

```typescript
// ============ 类型定义 ============

type StepStatus = 'wait' | 'process' | 'finish' | 'error';

interface StepItem {
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  status?: StepStatus;
  disabled?: boolean;
  onClick?: () => void;
}

interface StepsProps {
  // 数据（替代 children 的配置式用法）
  items?: StepItem[];
  
  // 当前步骤
  current?: number;
  defaultCurrent?: number;
  onChange?: (current: number) => void;
  
  // 布局
  direction?: 'horizontal' | 'vertical';
  size?: 'default' | 'small';
  labelPlacement?: 'horizontal' | 'vertical';
  
  // 进度
  progressDot?: boolean | React.FC<ProgressDotProps>;
  progressAnchor?: 'top' | 'bottom' | 'inline';
  
  // 导航
  clickable?: boolean;
  
  // 初始值
  initial?: number;
  
  // 样式
  className?: string;
  children?: React.ReactNode;
}

interface ProgressDotProps {
  index: number;
  status: StepStatus;
  title: React.ReactNode;
  description?: React.ReactNode;
}

// ============ Step 子组件 ============

interface StepProps {
  status?: StepStatus;
  title?: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

// ============ Compound ============

interface StepsCompound {
  (props: StepsProps): React.ReactElement;
  Step: React.FC<StepProps>;
}

// ============ Context ============

interface StepsContextValue {
  current: number;
  status: StepStatus[];
  direction: 'horizontal' | 'vertical';
  size: 'default' | 'small';
  labelPlacement: 'horizontal' | 'vertical';
  clickable: boolean;
  initial: number;
  progressDot: boolean | React.FC<ProgressDotProps>;
  progressAnchor: 'top' | 'bottom' | 'inline';
  onChange?: (current: number) => void;
}

// ============ Custom Hook ============

function useSteps(props: StepsProps) {
  const {
    current: propCurrent,
    defaultCurrent = 0,
    onChange,
    direction = 'horizontal',
    size = 'default',
    labelPlacement = 'horizontal',
    clickable = false,
    initial = 0,
    progressDot = false,
    progressAnchor = 'bottom',
  } = props;

  // 受控/非受控
  const [innerCurrent, setInnerCurrent] = useState(defaultCurrent);
  const isControlled = propCurrent !== undefined;
  const actualCurrent = isControlled ? propCurrent : innerCurrent;

  // 从 children 或 items 提取步骤
  const steps = useMemo(() => {
    if (props.items) return props.items;
    const children = React.Children.toArray(props.children);
    return children.map((child, idx) => {
      if (React.isValidElement(child) && child.type === Steps.Step) {
        return {
          title: child.props.title ?? `步骤 ${idx + 1}`,
          description: child.props.description,
          subtitle: child.props.subtitle,
          icon: child.props.icon,
          status: child.props.status,
          disabled: child.props.disabled,
          onClick: child.props.onClick,
        };
      }
      return { title: `步骤 ${idx + 1}` };
    });
  }, [props.items, props.children]);

  // 计算每个步骤的状态
  const statusList = useMemo(() => {
    return steps.map((_, idx) => {
      if (idx < actualCurrent) return 'finish';
      if (idx === actualCurrent) return 'process';
      return 'wait';
    });
  }, [steps.length, actualCurrent]);

  // 点击切换
  const handleStepClick = useCallback(
    (index: number) => {
      const step = steps[index];
      if (step?.disabled) return;
      if (!clickable && index > actualCurrent) return;
      if (!isControlled) setInnerCurrent(index);
      onChange?.(index);
      step?.onClick?.();
    },
    [steps, clickable, actualCurrent, isControlled, onChange]
  );

  return {
    actualCurrent,
    steps,
    statusList,
    direction,
    size,
    labelPlacement,
    clickable,
    initial,
    progressDot,
    progressAnchor,
    handleStepClick,
  };
}

// ============ 组件实现 ============

const Steps: StepsCompound = (props) => {
  const { className, ...rest } = props;
  const steps = useSteps(props);

  const contextValue: StepsContextValue = {
    current: steps.actualCurrent,
    status: steps.statusList,
    direction: steps.direction,
    size: steps.size,
    labelPlacement: steps.labelPlacement,
    clickable: steps.clickable,
    initial: steps.initial,
    progressDot: steps.progressDot,
    progressAnchor: steps.progressAnchor,
    onChange: steps.handleStepClick,
  };

  return (
    <StepsContext.Provider value={contextValue}>
      <div
        className={`steps steps-${steps.direction} steps-${steps.size} ${className ?? ''}`}
        role="navigation"
        aria-label="步骤导航"
      >
        {steps.steps.map((step, idx) => (
          <StepItem key={idx} index={idx} step={step} status={steps.statusList[idx]} />
        ))}
      </div>
    </StepsContext.Provider>
  );
};

// 单个步骤项
interface StepItemProps {
  index: number;
  step: StepItem;
  status: StepStatus;
}

const StepItem: React.FC<StepItemProps> = ({ index, step, status }) => {
  const ctx = React.useContext(StepsContext);
  const isLast = index === ctx.status.length - 1;
  const clickable = ctx.clickable || index < ctx.current;

  // 渲染图标
  const renderIcon = () => {
    if (step.icon) return step.icon;
    switch (status) {
      case 'finish': return <CheckIcon />;
      case 'error': return <CloseIcon />;
      case 'process': return <span className="step-number">{index + 1}</span>;
      default: return <span className="step-number">{index + 1}</span>;
    }
  };

  // 渲染进度点
  const renderProgressDot = () => {
    if (!ctx.progressDot) return null;
    if (typeof ctx.progressDot === 'function') {
      return ctx.progressDot({
        index,
        status,
        title: step.title,
        description: step.description,
      });
    }
    return <div className={`progress-dot ${status}`} />;
  };

  return (
    <div
      className={`step-item step-${status} ${step.disabled ? 'disabled' : ''}`}
      style={{ flex: isLast ? 'none' : 1 }}
      onClick={() => clickable && ctx.onChange?.(index)}
      role="tab"
      aria-selected={status === 'process'}
      aria-label={typeof step.title === 'string' ? step.title : undefined}
    >
      {/* 连接线 */}
      {!isLast && <div className={`step-line ${status === 'finish' ? 'finish' : ''}`} />}
      
      <div className="step-content">
        {/* 图标 */}
        <div className={`step-icon ${status}`}>
          {ctx.progressDot && ctx.progressAnchor === 'inline'
            ? renderProgressDot()
            : renderIcon()}
        </div>
        
        {/* 文字 */}
        <div className="step-text">
          <div className="step-title">{step.title}</div>
          {step.subtitle && <div className="step-subtitle">{step.subtitle}</div>}
          {step.description && (
            <div className="step-description">{step.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 子组件
const Step: React.FC<StepProps> = () => null; // 仅用于类型声明
Steps.Step = Step;

// ============ Steps 集成容器 ============

interface StepFormProps {
  steps: StepFormConfig[];
  onFinish?: (values: Record<string, any>) => void;
}

interface StepFormConfig {
  title: string;
  description?: string;
  component: React.FC<{ values: Record<string, any>; onChange: (values: Record<string, any>) => void }>;
  validate?: (values: Record<string, any>) => string | null;
}

/**
 * Steps + Form 集成组件
 * 将步骤条与表单结合，支持步骤间验证
 */
const StepForm: React.FC<StepFormProps> = ({ steps, onFinish }) => {
  const [current, setCurrent] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>[]>(
    steps.map(() => ({}))
  );
  const [errors, setErrors] = useState<(string | null)[]>(steps.map(() => null));

  const handleNext = () => {
    // 验证当前步骤
    const step = steps[current];
    if (step.validate) {
      const error = step.validate(formValues[current]);
      if (error) {
        setErrors(prev => { const n = [...prev]; n[current] = error; return n; });
        return;
      }
    }
    setCurrent(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handlePrev = () => {
    setCurrent(prev => Math.max(prev - 1, 0));
  };

  const handleFinish = () => {
    // 验证所有步骤
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].validate) {
        const error = steps[i].validate(formValues[i]);
        if (error) {
          setErrors(prev => { const n = [...prev]; n[i] = error; return n; });
          setCurrent(i);
          return;
        }
      }
    }
    // 合并所有值
    const merged = formValues.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    onFinish?.(merged);
  };

  const stepItems = steps.map(s => ({
    title: s.title,
    description: s.description,
  }));

  const CurrentComponent = steps[current].component;

  return (
    <div className="step-form">
      <Steps current={current} items={stepItems} />
      <div className="step-form-body">
        <CurrentComponent
          values={formValues[current]}
          onChange={(values) => {
            setFormValues(prev => {
              const n = [...prev];
              n[current] = { ...n[current], ...values };
              return n;
            });
            // 清除错误
            setErrors(prev => { const n = [...prev]; n[current] = null; return n; });
          }}
        />
        {errors[current] && <div className="step-error">{errors[current]}</div>}
      </div>
      <div className="step-form-actions">
        {current > 0 && (
          <button onClick={handlePrev}>上一步</button>
        )}
        {current < steps.length - 1 ? (
          <button onClick={handleNext} type="primary">下一步</button>
        ) : (
          <button onClick={handleFinish} type="primary">完成</button>
        )}
      </div>
    </div>
  );
};

// ============ 使用示例 ============

/**
 * 示例 1: 基础水平步骤条
 */
function Example1() {
  const [current, setCurrent] = useState(0);
  return (
    <Steps current={current} onChange={setCurrent} clickable>
      <Steps.Step title="填写信息" description="请填写基本信息" />
      <Steps.Step title="确认订单" description="确认订单信息" />
      <Steps.Step title="支付" description="选择支付方式" />
      <Steps.Step title="完成" description="支付成功" />
    </Steps>
  );
}

/**
 * 示例 2: 垂直步骤条
 */
function Example2() {
  return (
    <Steps
      direction="vertical"
      current={1}
      items={[
        { title: '创建项目', description: '创建项目基本信息', status: 'finish' },
        { title: '配置环境', description: '配置开发环境', status: 'process' },
        { title: '部署上线', description: '部署到生产环境', status: 'wait' },
      ]}
    />
  );
}

/**
 * 示例 3: 迷你步骤条 + 进度点
 */
function Example3() {
  return (
    <Steps
      size="small"
      current={2}
      progressDot
      items={[
        { title: '上传' },
        { title: '转换' },
        { title: '审核' },
        { title: '发布' },
      ]}
    />
  );
}

/**
 * 示例 4: 带错误的步骤
 */
function Example4() {
  return (
    <Steps
      current={2}
      items={[
        { title: '步骤一', status: 'finish' },
        { title: '步骤二', status: 'finish' },
        { title: '步骤三', status: 'error', description: '网络错误，请重试' },
        { title: '步骤四', status: 'wait' },
      ]}
    />
  );
}

/**
 * 示例 5: 步骤表单集成
 */
function Example5() {
  return (
    <StepForm
      steps={[
        {
          title: '基本信息',
          description: '填写用户名和邮箱',
          component: UserInfoForm,
          validate: (values) => {
            if (!values.name) return '请输入用户名';
            if (!values.email?.includes('@')) return '请输入有效邮箱';
            return null;
          },
        },
        {
          title: '详细资料',
          description: '填写个人简介',
          component: ProfileForm,
        },
        {
          title: '确认提交',
          description: '确认信息无误后提交',
          component: ConfirmForm,
        },
      ]}
      onFinish={(values) => {
        console.log('提交:', values);
      }}
    />
  );
}
```

---

# 组件 5：Notification 通知系统 (Hook + Portal + Queue)

## 设计理念

通知系统是全局 UI 基础设施。核心挑战：
- 全局单例管理
- 队列 + 自动销毁
- 多种类型 + 自定义
- 位置布局
- 堆叠动画
- 操作按钮 + 回调
- 手动/自动关闭

### 核心特性
- 全局单例（通过 Hook 管理）
- 4 种类型（info/success/warning/error）
- 自动关闭 + 手动关闭
- 队列管理（同时最多 N 个）
- 4 个位置（topLeft/topRight/bottomLeft/bottomRight）
- 操作按钮 + 关闭回调
- 自定义图标 + 描述
- 堆叠动画（进入/退出）
- 可配置全局默认值

### API 设计

```typescript
// ============ 类型定义 ============

type NotificationType = 'info' | 'success' | 'warning' | 'error';
type NotificationPlacement = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface NotificationConfig {
  // 内容
  message: React.ReactNode;
  description?: React.ReactNode;
  
  // 类型
  type?: NotificationType;
  
  // 图标
  icon?: React.ReactNode;
  customIcon?: React.ReactNode;
  
  // 行为
  duration?: number; // 自动关闭时间，0 表示不自动关闭
  closable?: boolean;
  closeText?: React.ReactNode;
  
  // 操作
  actions?: NotificationAction[];
  onClick?: () => void;
  onClose?: () => void;
  
  // 位置
  placement?: NotificationPlacement;
  
  // 样式
  className?: string;
  style?: React.CSSProperties;
  
  // 唯一标识
  key?: string;
}

interface NotificationAction {
  label: React.ReactNode;
  onClick: (key: string) => void;
  type?: 'default' | 'primary';
}

interface NotificationItem extends NotificationConfig {
  id: string;
  visible: boolean;
}

interface NotificationProviderProps {
  // 全局配置
  maxCount?: number;
  defaultDuration?: number;
  defaultPlacement?: NotificationPlacement;
  rtl?: boolean;
  top?: number;
  bottom?: number;
  gap?: number;
}

// ============ Context ============

interface NotificationContextValue {
  // 各位置的通知列表
  notifications: Record<NotificationPlacement, NotificationItem[]>;
  
  // 操作方法
  open: (config: NotificationConfig) => string;
  close: (key: string) => void;
  clear: (placement?: NotificationPlacement) => void;
  
  // 快捷方法
  info: (config: Omit<NotificationConfig, 'type'>) => string;
  success: (config: Omit<NotificationConfig, 'type'>) => string;
  warning: (config: Omit<NotificationConfig, 'type'>) => string;
  error: (config: Omit<NotificationConfig, 'type'>) => string;
}

// ============ Custom Hook ============

function useNotification(config?: NotificationProviderProps) {
  const {
    maxCount = 5,
    defaultDuration = 3000,
    defaultPlacement = 'topRight',
    top = 24,
    bottom = 24,
    gap = 8,
  } = config ?? {};

  const [notifications, setNotifications] = useState<Record<NotificationPlacement, NotificationItem[]>>({
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
  });

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 生成唯一 key
  const generateKey = (): string => {
    return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  // 打开通知
  const open = useCallback(
    (cfg: NotificationConfig): string => {
      const key = cfg.key ?? generateKey();
      const placement = cfg.placement ?? defaultPlacement;
      const duration = cfg.duration ?? defaultDuration;

      const newItem: NotificationItem = {
        ...cfg,
        key,
        id: key,
        type: cfg.type ?? 'info',
        duration,
        closable: cfg.closable ?? true,
        visible: false, // 初始不可见，动画进入后变为 true
      };

      setNotifications(prev => {
        const list = prev[placement];
        // 队列管理：超过 maxCount 时移除最旧的
        const newList = [...list, newItem];
        if (newList.length > maxCount) {
          // 关闭最旧的
          const removed = newList.shift()!;
          // 触发退出动画后移除
          setTimeout(() => {
            setNotifications(p => ({
              ...p,
              [placement]: p[placement].filter(n => n.key !== removed.key),
            }));
          }, 300);
        }
        return { ...prev, [placement]: newList };
      });

      // 下一帧触发动画
      requestAnimationFrame(() => {
        setNotifications(prev => ({
          ...prev,
          [placement]: prev[placement].map(n =>
            n.key === key ? { ...n, visible: true } : n
          ),
        }));
      });

      // 自动关闭
      if (duration > 0) {
        timersRef.current[key] = setTimeout(() => {
          close(key);
        }, duration);
      }

      return key;
    },
    [maxCount, defaultDuration, defaultPlacement]
  );

  // 关闭通知
  const close = useCallback(
    (key: string) => {
      // 清除定时器
      if (timersRef.current[key]) {
        clearTimeout(timersRef.current[key]);
        delete timersRef.current[key];
      }

      // 触发退出动画
      setNotifications(prev => {
        const result = { ...prev };
        for (const placement of Object.keys(result) as NotificationPlacement[]) {
          result[placement] = result[placement].map(n =>
            n.key === key ? { ...n, visible: false } : n
          );
        }
        return result;
      });

      // 动画结束后移除
      setTimeout(() => {
        setNotifications(prev => {
          const result = { ...prev };
          for (const placement of Object.keys(result) as NotificationPlacement[]) {
            result[placement] = result[placement].filter(n => n.key !== key);
          }
          return result;
        });
      }, 300);
    },
    []
  );

  // 清空
  const clear = useCallback(
    (placement?: NotificationPlacement) => {
      if (placement) {
        notifications[placement].forEach(n => close(n.key));
      } else {
        (Object.keys(notifications) as NotificationPlacement[]).forEach(p => {
          notifications[p].forEach(n => close(n.key));
        });
      }
    },
    [notifications, close]
  );

  // 快捷方法
  const info = useCallback(
    (cfg: Omit<NotificationConfig, 'type'>) => open({ ...cfg, type: 'info' }),
    [open]
  );
  const success = useCallback(
    (cfg: Omit<NotificationConfig, 'type'>) => open({ ...cfg, type: 'success' }),
    [open]
  );
  const warning = useCallback(
    (cfg: Omit<NotificationConfig, 'type'>) => open({ ...cfg, type: 'warning' }),
    [open]
  );
  const error = useCallback(
    (cfg: Omit<NotificationConfig, 'type'>) => open({ ...cfg, type: 'error' }),
    [open]
  );

  // 清理
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  return {
    notifications,
    open,
    close,
    clear,
    info,
    success,
    warning,
    error,
    // 布局参数
    top,
    bottom,
    gap,
  };
}

// ============ Provider 组件 ============

const NotificationContext = React.createContext<NotificationContextValue | null>(null);

const NotificationProvider: React.FC<NotificationProviderProps & { children: React.ReactNode }> = ({
  children,
  ...config
}) => {
  const notification = useNotification(config);

  // 默认图标映射
  const typeIcons: Record<NotificationType, React.ReactNode> = {
    info: <InfoIcon />,
    success: <CheckCircleIcon />,
    warning: <ExclamationCircleIcon />,
    error: <CloseCircleIcon />,
  };

  return (
    <NotificationContext.Provider value={notification}>
      {children}
      {/* 渲染各位置的通知容器 */}
      {(Object.keys(notification.notifications) as NotificationPlacement[]).map(placement => {
        const list = notification.notifications[placement];
        if (list.length === 0) return null;

        const isTop = placement.startsWith('top');
        const isLeft = placement.endsWith('Left');

        return (
          <div
            key={placement}
            className={`notification-container notification-${placement}`}
            style={{
              position: 'fixed',
              [isTop ? 'top' : 'bottom']: notification.top,
              [isLeft ? 'left' : 'right']: notification.top,
              zIndex: 9999,
              display: 'flex',
              flexDirection: isTop ? 'column' : 'column-reverse',
              gap: notification.gap,
              pointerEvents: 'none',
            }}
          >
            {list.map((item, idx) => {
              const icon = item.customIcon ?? item.icon ?? typeIcons[item.type ?? 'info'];
              const offsetY = idx * (80 + notification.gap);

              return (
                <div
                  key={item.key}
                  className={`notification notification-${item.type} ${item.visible ? 'enter' : 'exit'}`}
                  style={{
                    pointerEvents: 'auto',
                    minWidth: 300,
                    maxWidth: 400,
                    background: '#fff',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: 16,
                    display: 'flex',
                    gap: 12,
                    transform: item.visible ? 'translateX(0)' : (isLeft ? 'translateX(-100%)' : 'translateX(100%)'),
                    opacity: item.visible ? 1 : 0,
                    transition: 'all 0.3s ease',
                  }}
                  onClick={item.onClick}
                  role="alert"
                  aria-live="assertive"
                >
                  {/* 图标 */}
                  <div className="notification-icon" style={{ fontSize: 20, flexShrink: 0 }}>
                    {icon}
                  </div>
                  
                  {/* 内容 */}
                  <div className="notification-content" style={{ flex: 1 }}>
                    <div className="notification-message" style={{ fontWeight: 500, marginBottom: 4 }}>
                      {item.message}
                    </div>
                    {item.description && (
                      <div className="notification-description" style={{ fontSize: 13, color: '#666' }}>
                        {item.description}
                      </div>
                    )}
                    
                    {/* 操作按钮 */}
                    {item.actions && item.actions.length > 0 && (
                      <div className="notification-actions" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        {item.actions.map((action, i) => (
                          <button
                            key={i}
                            className={`notification-action ${action.type === 'primary' ? 'primary' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(item.key);
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* 关闭按钮 */}
                  {item.closable && (
                    <button
                      className="notification-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        notification.close(item.key);
                      }}
                      aria-label="关闭"
                    >
                      {item.closeText || '×'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </NotificationContext.Provider>
  );
};

// ============ 全局 API (命令式) ============

let globalNotification: NotificationContextValue | null = null;

/**
 * 全局通知 API（命令式调用，无需 Provider）
 * 内部自动创建 Provider
 */
const notification = {
  open: (config: NotificationConfig) => {
    if (!globalNotification) {
      // 首次调用时创建
      const container = document.createElement('div');
      document.body.appendChild(container);
      // 通过 ref 获取实例
      // 实际实现中通过 createPortal + ref 获取
    }
    return globalNotification?.open(config) ?? '';
  },
  info: (config: Omit<NotificationConfig, 'type'>) => globalNotification?.info(config) ?? '',
  success: (config: Omit<NotificationConfig, 'type'>) => globalNotification?.success(config) ?? '',
  warning: (config: Omit<NotificationConfig, 'type'>) => globalNotification?.warning(config) ?? '',
  error: (config: Omit<NotificationConfig, 'type'>) => globalNotification?.error(config) ?? '',
  close: (key: string) => globalNotification?.close(key),
  clear: (placement?: NotificationPlacement) => globalNotification?.clear(placement),
};

// ============ useNotification Hook (消费端) ============

function useNotificationApi() {
  const ctx = React.useContext(NotificationContext);
  if (!ctx) {
    // 降级到全局 API
    return notification;
  }
  return ctx;
}

// ============ 使用示例 ============

/**
 * 示例 1: Provider 模式
 */
function App() {
  return (
    <NotificationProvider maxCount={3} defaultDuration={5000}>
      <MyApp />
    </NotificationProvider>
  );
}

/**
 * 示例 2: Hook 调用
 */
function MyComponent() {
  const notify = useNotificationApi();

  const handleSave = async () => {
    try {
      await saveData();
      notify.success({
        message: '保存成功',
        description: '数据已保存到服务器',
      });
    } catch (err) {
      notify.error({
        message: '保存失败',
        description: err.message,
        duration: 0, // 不自动关闭
        actions: [
          { label: '重试', onClick: () => handleSave(), type: 'primary' },
          { label: '忽略', onClick: (key) => notify.close(key) },
        ],
      });
    }
  };

  return <button onClick={handleSave}>保存</button>;
}

/**
 * 示例 3: 不同位置
 */
function Example3() {
  const notify = useNotificationApi();
  return (
    <div>
      <button onClick={() => notify.info({
        message: '左上通知',
        placement: 'topLeft',
      })}>左上</button>
      <button onClick={() => notify.success({
        message: '右下通知',
        placement: 'bottomRight',
      })}>右下</button>
    </div>
  );
}

/**
 * 示例 4: 自定义图标 + 描述
 */
function Example4() {
  const notify = useNotificationApi();
  return (
    <button onClick={() => notify.open({
      message: '系统更新',
      description: '新版本 v2.0 已发布，点击查看详情',
      icon: <RocketIcon />,
      duration: 0,
      actions: [
        { label: '查看详情', onClick: () => window.open('/changelog'), type: 'primary' },
        { label: '稍后', onClick: (key) => notify.close(key) },
      ],
    })}>
      显示通知
    </button>
  );
}

/**
 * 示例 5: 批量通知 + 队列管理
 */
function Example5() {
  const notify = useNotificationApi();

  const handleImport = async () => {
    const loadingKey = notify.open({
      message: '导入中...',
      description: '正在处理文件，请稍候',
      duration: 0,
      closable: false,
    });

    try {
      const result = await importFile();
      notify.close(loadingKey);
      notify.success({
        message: `导入完成`,
        description: `成功导入 ${result.success} 条，失败 ${result.failed} 条`,
        actions: result.failed > 0 ? [
          { label: '查看失败记录', onClick: () => showFailedList() },
        ] : undefined,
      });
    } catch (err) {
      notify.close(loadingKey);
      notify.error({
        message: '导入失败',
        description: err.message,
      });
    }
  };

  return <button onClick={handleImport}>导入数据</button>;
}
```

---

## 总结：5 个组件的设计模式矩阵

| 组件 | 核心模式 | 辅助模式 | 关键技术 | 性能策略 |
|------|---------|---------|---------|---------|
| **DatePicker** | Compound + Hook | Portal | 日历算法 + 键盘导航 | 虚拟滚动(年视图) |
| **Transfer** | Compound + Hook | Virtual Scroll | 双列表状态管理 | 虚拟滚动(万级) |
| **Carousel** | Hook + 手势 | 响应式 | 触摸/鼠标事件 | will-change + transform |
| **Steps** | Compound + Context | Form 集成 | 状态机 + 验证 | 按需渲染 |
| **Notification** | Hook + Portal | 队列 + 单例 | 全局状态管理 | 动画帧 + 自动回收 |

## 设计模式使用总结

### 本轮覆盖的模式
1. **Compound Components** — DatePicker, Transfer, Steps
2. **Custom Hooks** — 5 个组件全部使用
3. **Portal** — DatePicker, Notification
4. **Context** — Steps, Notification
5. **Virtual Scroll** — Transfer, DatePicker
6. **手势系统** — Carousel
7. **队列管理** — Notification
8. **响应式** — Carousel
9. **受控/非受控** — 全部组件
10. **状态机** — Steps (StepForm)

### API 设计原则
- 一致的命名：value/onChange/defaultValue
- 受控优先，非受控降级
- 事件统一 onXxx 命名
- 配置式 + 声明式双 API
- TypeScript 完整类型推导
- 默认值合理，最少配置可用

### 可组合性
- Hook 可独立使用（不绑定 UI）
- Compound 子组件可自由组合
- 自定义渲染（render/children）
- 主题/样式可覆盖
- 与表单/路由等系统集成
