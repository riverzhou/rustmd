# Markdown 综合测试文件

## 1. 标题与段落
### 1.1 一级标题
#### 1.2 二级标题
这是一个段落，包含**加粗**、*斜体*、~~删除线~~和`行内代码`。

## 2. 列表
### 2.1 无序列表
- 项目一
- 项目二
  - 子项目二
### 2.2 有序列表
1. 第一项
2. 第二项

## 3. Mermaid 图表
### 3.1 流程图
```mermaid
graph LR
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[结束]
    C --> D
```

### 3.2 时序图
```mermaid
sequenceDiagram
    participant 客户端
    participant 服务器
    客户端->>服务器: 发送请求
    activate 服务器
    服务器-->>客户端: 返回响应
    deactivate 服务器
    客户端->>客户端: 处理数据
```

### 3.3 类图
```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +breed String
        +fetch() void
    }
    class Cat {
        +color String
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

### 3.4 甘特图
```mermaid
gantt
    title 项目进度
    dateFormat  YYYY-MM-DD
    section 设计
    需求分析           :done,    des1, 2024-01-06, 2024-01-08
    架构设计           :active,  des2, 2024-01-09, 3d
    详细设计           :          des3, after des2, 5d
    section 开发
    前端开发           :          dev1, 2024-01-15, 10d
    后端开发           :          dev2, 2024-01-17, 12d
    section 测试
    单元测试           :          test1, after dev1, 5d
    集成测试           :          test2, after dev2, 3d
```

### 3.5 状态图
```mermaid
stateDiagram-v2
    [*] --> 待审核
    待审核 --> 审核中
    审核中 --> 已通过
    审核中 --> 已拒绝
    已通过 --> 发布中
    发布中 --> 已发布
    已发布 --> [*]
    已拒绝 --> [*]
```

### 3.6 饼图
```mermaid
pie
    title 浏览器市场份额
    "Chrome" : 65
    "Safari" : 19
    "Firefox" : 8
    "Edge" : 5
    "其他" : 3
```

### 3.7 实体关系图
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
        int customer_id
    }
    ORDER {
        int order_id
        string status
        date order_date
    }
    LINE-ITEM {
        int line_item_id
        int quantity
        float price
    }
```

---

## 4. HTML 混合内容
<div style="border:1px solid #ccc; padding:10px; margin:10px 0;">
    <p style="color:red;">这是HTML嵌入的红色段落</p>
    <table border="1">
        <tr><th>HTML表头</th><th>值</th></tr>
        <tr><td>A</td><td>1</td></tr>
    </table>
</div>

<details>
<summary>点击展开详情</summary>
这里是折叠内容，支持Markdown语法：
- 列表项1
- 列表项2
</details>

---

## 5. 特殊符号与Emoji
© ® ™ € £ ¥ ± × ÷ ≠ ≤ ≥ ∞ ∂ √ ∑ ∏ ∫ ∆ ∇

😀 🎉 🚀 ❤️ ✅ ⚠️ 🔥 💡 📝

---

## 6. 综合复杂示例

### 6.1 嵌套结构

> **注意：** 引用内部可以包含多种元素：
>
> ```python
> def nested_example():
>     pass
> ```
>
> - 列表项
> - 另一项
>
> | 列1 | 列2 |
> |-----|-----|
> | 数据 | 数据 |

### 6.2 带公式的流程图（已修正为标准Mermaid语法）

```mermaid
graph LR
    A["输入 x"] --> B{x > 0?}
    B -->|"是"| C["f(x) = x²"]
    B -->|"否"| D["f(x) = eˣ"]
    C --> E["输出"]
    D --> E
```

---

**测试完成！**
