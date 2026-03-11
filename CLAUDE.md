# Coding Style Guide

## General
- Language: HTML / CSS / JavaScript
- Indentation: 2 spaces
- Comments: Korean

---

## HTML
- 속성값은 큰따옴표 사용 (`"`)
- 시맨틱 태그 우선 사용 (`<section>`, `<article>`, `<nav>` 등)
- 자기 닫힘 태그는 슬래시 생략 (`<br>`, `<img>`)

---

## CSS
- 반드시 별도의 `style.css` 파일로 분리하여 `<link>`로 호출
- 단일 파일 결과물(Artifact 등)은 예외적으로 `<style>` 태그 허용
- 인라인 스타일 사용 금지
- 클래스명은 `kebab-case` 사용 (예: `.main-header`)

### 작성 형식
```css
.class-name {

  color: red;
  font-size: 16px;

}
```

- 선택자와 `{` 사이에 공백
- `{` 다음에 빈 줄
- 속성에서 `:` 뒤에 공백 (예: `color: red;`)
- 마지막 속성과 `}` 사이에 빈 줄

---

## JavaScript
- `var` 사용 금지 → `const` / `let` 사용
- 세미콜론 필수
- 문자열은 작은따옴표 사용 (`'`)
- 반드시 별도의 `script.js` 파일로 분리하여 `<script src>` 로 호출
- 단일 파일 결과물(Artifact 등)은 예외적으로 `<script>` 태그 허용