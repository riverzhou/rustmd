# Markdown 数学公式指南（LaTeX / KaTeX）

本指南介绍在 Markdown 中用 LaTeX/KaTeX 写行内公式与块级公式，以及分数、上下标、根号、希腊字母、求和、积分、矩阵、分段函数等常用语法。

## 1. 行内公式与块级公式

在 Markdown 中使用单个 `$` 包裹 LaTeX 公式可插入行内公式：

- 爱因斯坦质能方程：$E = mc^2$
- 勾股定理：$a^2 + b^2 = c^2$
- 圆面积公式：$A = \pi r^2$

行内公式与正文在同一行，适合嵌入简短表达式。

使用双 `$$
` 包裹可创建块级公式，公式独占一行并居中：

$$
E = mc^2
$$

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

块级公式适合展示较长或需要突出的数学表达式。

## 2. 基本运算符

- 加减：$a + b$、$a - b$
- 乘法：$a \times b$、$a \cdot b$
- 除法：$a \div b$
- 幂：$x^2$、$x^3$、$2^{10}$
- 取模：$a \mod b$
- 综合示例：

$$
(x + y)^2 = x^2 + 2xy + y^2
$$

常用比较运算符：$<$、$>$、$\leq$、$\geq$、$\neq$、$\approx$、$\equiv$。

## 3. 分数与根号

分数使用 `\frac{分子}{分母}`：

- 简单分数：$\frac{1}{2}$、$\frac{3}{4}$
- 复杂分数：$\frac{a+b}{c-d}$
- 行内放大：用 `\dfrac` $\dfrac{a}{b}$ 对比 `\frac` $\frac{a}{b}$

嵌套分数：

$$
\frac{1}{1+\frac{1}{1+\frac{1}{2}}}
$$

根号使用 `\sqrt{}` 表示平方根，`\sqrt[n]{}` 表示 n 次方根：

- 平方根：$\sqrt{2}$、$\sqrt{x^2 + y^2}$
- n 次方根：$\sqrt[3]{8}$、$\sqrt[n]{x}$

一元二次方程求根公式：

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

## 4. 上标与下标

- 上标：$x^2$、$x^3$、$x^{n+1}$，多字符需花括号如 $x^{10}$
- 下标：$x_1$、$x_2$、$x_{i,j}$，多字符如 $a_{max}$
- 上下标组合：$x_1^2$、$a_i^n$

## 5. 希腊字母

小写：$\alpha$、$\beta$、$\gamma$、$\delta$、$\epsilon$、$\zeta$、$\eta$、$\theta$、$\lambda$、$\mu$、$\nu$、$\xi$、$\pi$、$\rho$、$\sigma$、$\tau$、$\phi$、$\chi$、$\psi$、$\omega$

大写：$\Gamma$、$\Delta$、$\Theta$、$\Lambda$、$\Xi$、$\Pi$、$\Sigma$、$\Phi$、$\Psi$、$\Omega$

变体：$\varepsilon$、$\vartheta$、$\varphi$

应用示例：

- 物理：$\omega = 2\pi f$、$\lambda$、$\rho$
- 统计：$\mu$ 均值、$\sigma$ 标准差、$\Omega$ 样本空间
- 差分：$\Delta x = x_2 - x_1$

## 6. 求和、连乘、极限

求和：

$$
\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}
$$

连乘：

$$
n! = \prod_{i=1}^{n} i
$$

极限：

$$
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$

行内写法：$\sum_{i=1}^{n} i$、$\prod_{k=1}^{n} k$、$\lim_{x \to 0} f(x)$。

## 7. 积分

不定积分：

$$
\int x^2 \, dx = \frac{x^3}{3} + C
$$

定积分：

$$
\int_{0}^{1} x^2 \, dx = \frac{1}{3}
$$

多重积分：

$$
\iint_D f(x,y) \, dx \, dy
$$

$$
\iiint_V f(x,y,z) \, dx \, dy \, dz
$$

曲线积分：

$$
\oint_C \vec{F} \cdot d\vec{r}
$$

## 8. 矩阵

无括号矩阵：

$$
\begin{matrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{matrix}
$$

圆括号矩阵：

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

方括号矩阵：

$$
\begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
$$

花括号矩阵：

$$
\begin{Bmatrix}
a & b \\
c & d
\end{Bmatrix}
$$

行列式：

$$
\begin{vmatrix}
a & b \\
c & d
\end{vmatrix} = ad - bc
$$

省略号矩阵：

$$
\begin{pmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{pmatrix}
$$

## 9. 多行对齐与分段函数

对齐方程，用 `align`，`&` 指定对齐位置：

$$
\begin{align}
f(x) &= x^2 + 2x + 1 \\
&= (x+1)^2
\end{align}
$$

多步推导：

$$
\begin{align}
(a+b)^2 &= (a+b)(a+b) \\
&= a^2 + ab + ba + b^2 \\
&= a^2 + 2ab + b^2
\end{align}
$$

分段函数，用 `cases`：

$$
f(x) =
\begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
$$

方程组：

$$
\begin{cases}
x + y = 5 \\
2x - y = 1
\end{cases}
$$

绝对值：

$$
|x| =
\begin{cases}
x & x \geq 0 \\
-x & x < 0
\end{cases}
$$

## 10. 括号与定界符

自动缩放用 `\left` 和 `\right`：

- 普通：$(\frac{a}{b})$
- 自动缩放：$\left(\frac{a}{b}\right)$

单侧括号示例：

$$
\left. \frac{dy}{dx} \right|_{x=1}
$$

## 11. 函数名、向量与字体

正体函数名：

- 三角：$\sin x$、$\cos x$、$\tan x$
- 对数：$\log x$、$\ln x$、$\exp(x)$
- 最值：$\max(a,b)$、$\min(a,b)$
- 线性代数：$\det(A)$、$\dim(V)$

向量与特殊符号：

- 向量：$\vec{a}$、$\mathbf{a}$
- 单位向量/估计值：$\hat{x}$

## 12. 间距、正文与颜色

- 细空格：`\,`，例如积分 $\int_0^1 x^2\,dx$
- 宽空格：`\quad`，例如：

$$
\int_0^1 x^2 \, dx \quad \text{vs} \quad \int_0^1 x^2 dx
$$

- 公式内插入文字：

$$
\text{当 } x>0 \text{ 时，有 } f(x)=\sqrt{x}
$$

- 颜色（KaTeX 支持 `\textcolor`）：

$$
\textcolor{red}{E} = mc^2
$$

## 13. 物理与高级示例

牛顿第二定律：

$$
\vec{F} = m\vec{a} = m\frac{d\vec{v}}{dt}
$$

薛定谔方程：

$$
i\hbar\frac{\partial}{\partial t}\Psi(\vec{r},t) = \hat{H}\Psi(\vec{r},t)
$$

欧拉公式：

$$
e^{i\pi} + 1 = 0
$$

泰勒展开：

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n
$$

高斯积分：

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

## 14. 排版技巧与注意事项

- 转义：数学模式中 `%`、`&`、`_`、`{`、`}`、`$` 等需用反斜杠转义，例如 `\$`、`\%`、`\&`、`\_`、`\{`、`\}`
- 长公式换行：在 `align` 中用 `\\`，续行可加 `\quad`

$$
\begin{align}
y &= a_0 + a_1x + a_2x^2 \\
&\quad + a_3x^3 + a_4x^4
\end{align}
$$

- 自定义编号：用 `\tag{}`

$$
a^n + b^n = c^n \tag{1}
$$

- 行内若公式较复杂，建议改为 `
$$` 块级公式以提高可读性。