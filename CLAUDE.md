# Coding Style Guide

## General
- Language: HTML / CSS / JavaScript
- Indentation: 2 spaces
- Comments: Korean

## CSS
- CSS는 반드시 별도의 `style.css` 파일로 분리하여 HTML에서 link로 호출
- 인라인 스타일 사용 금지
- CSS 작성 형식:
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
