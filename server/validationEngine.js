const { JSDOM } = require('jsdom');

/**
 * 根据关卡的 validatorType + validatorConfig 校验用户提交的代码
 * @param {object} level Sequelize Level 实例
 * @param {{ html?: string, css?: string, js?: string }} code
 * @returns {{ pass: boolean, errors: Array<{ code: string, message: string, meta?: any }> }}
 */
async function validateLevel(level, code) {
  const html = code.html || '';
  const css = code.css || '';
  const js = code.js || '';
  const normalized = normalizeSources({ html, css, js });

  const customErrors = runCustomLevelChecks(level.key, normalized);
  if (customErrors) {
    return {
      pass: customErrors.length === 0,
      errors: customErrors,
    };
  }

  const type = level.validatorType || 'regex';
  let config = {};
  try {
    config = level.validatorConfig ? JSON.parse(level.validatorConfig) : {};
  } catch (e) {
    // 配置解析失败时，直接通过，避免阻塞玩家
    return {
      pass: true,
      errors: [],
    };
  }

  const errors = [];

  if (type === 'dom') {
    runDomChecks(normalized.html, config, errors);
  } else if (type === 'regex') {
    runRegexChecks(normalized, config, errors);
  } else {
    // 未知类型暂时默认通过
    return {
      pass: true,
      errors: [],
    };
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

function normalizeSources(input) {
  const html = String(input.html || '');
  const css = String(input.css || '');
  const js = String(input.js || '');
  const merged = `${html}\n${css}\n${js}`;

  const extractedCss = extractByTag(html, 'style');
  const extractedJs = extractByTag(html, 'script');

  // 兼容当前前端“单编辑区”模式：同一文本会同时传 html/css/js
  return {
    html: html || merged,
    css: `${css}\n${extractedCss}\n${merged}`,
    js: `${js}\n${extractedJs}\n${merged}`,
    merged,
  };
}

function extractByTag(html, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const chunks = [];
  let match = re.exec(html);
  while (match) {
    chunks.push(match[1] || '');
    match = re.exec(html);
  }
  return chunks.join('\n');
}

function runDomChecks(html, config, errors) {
  const dom = new JSDOM(html || '<!doctype html><html><body></body></html>');
  const document = dom.window.document;

  if (Array.isArray(config.mustExistTags)) {
    for (const tag of config.mustExistTags) {
      if (!document.querySelector(tag)) {
        errors.push({
          code: 'MISSING_TAG',
          message: `页面中需要至少一个 <${tag}> 标签。`,
          meta: { tag },
        });
      }
    }
  }

  if (Array.isArray(config.mustExistSelectors)) {
    for (const selector of config.mustExistSelectors) {
      if (!document.querySelector(selector)) {
        errors.push({
          code: 'MISSING_SELECTOR',
          message: `没有找到匹配选择器 "${selector}" 的元素。`,
          meta: { selector },
        });
      }
    }
  }
}

function runRegexChecks(sources, config, errors) {
  const { html = '', css = '', js = '' } = sources;

  if (Array.isArray(config.htmlMustMatch)) {
    for (const pattern of config.htmlMustMatch) {
      const re = new RegExp(pattern, 'i');
      if (!re.test(html)) {
        errors.push({
          code: 'HTML_REGEX_NOT_MATCH',
          message: `HTML 代码中未匹配到预期结构：${pattern}`,
          meta: { pattern },
        });
      }
    }
  }

  if (Array.isArray(config.cssMustMatch)) {
    for (const pattern of config.cssMustMatch) {
      const re = new RegExp(pattern, 'i');
      if (!re.test(css)) {
        errors.push({
          code: 'CSS_REGEX_NOT_MATCH',
          message: `CSS 中未匹配到预期样式：${pattern}`,
          meta: { pattern },
        });
      }
    }
  }

  if (Array.isArray(config.jsMustMatch)) {
    for (const pattern of config.jsMustMatch) {
      const re = new RegExp(pattern, 'i');
      if (!re.test(js)) {
        errors.push({
          code: 'JS_REGEX_NOT_MATCH',
          message: `JavaScript 中未匹配到预期语句：${pattern}`,
          meta: { pattern },
        });
      }
    }
  }
}

function runCustomLevelChecks(levelKey, sources) {
  const dom = new JSDOM(sources.html || '<!doctype html><html><body></body></html>');
  const document = dom.window.document;
  const errors = [];
  const push = (code, message, meta) => errors.push({ code, message, meta: meta || {} });

  const checks = {
    'html-foundation': () => {
      if (!document.querySelector('h1')) push('MISSING_TAG', '需要至少一个 <h1> 标签', { tag: 'h1' });
      if (!document.querySelector('p')) push('MISSING_TAG', '需要至少一个 <p> 标签', { tag: 'p' });
    },
    'html-password-form': () => {
      if (!document.querySelector('input[type="password"]')) {
        push('MISSING_SELECTOR', '需要 input[type="password"]', { selector: 'input[type="password"]' });
      }
      if (!document.querySelector('button, input[type="submit"]')) {
        push('MISSING_SELECTOR', '需要提交按钮（button 或 input[type="submit"]）', {
          selector: 'button, input[type="submit"]',
        });
      }
    },
    'css-color-and-font': () => {
      mustMatch(sources.css, /color\s*:\s*[^;]+;/i, 'CSS_REGEX_NOT_MATCH', '需要设置 color');
      mustMatch(sources.css, /font-size\s*:\s*[^;]+;/i, 'CSS_REGEX_NOT_MATCH', '需要设置 font-size');
    },
    'css-flex-bridge': () => {
      mustMatch(sources.css, /display\s*:\s*flex\s*;/i, 'CSS_REGEX_NOT_MATCH', '需要 display:flex');
      mustMatch(
        sources.css,
        /justify-content\s*:\s*space-around\s*;/i,
        'CSS_REGEX_NOT_MATCH',
        '需要 justify-content: space-around'
      );
    },
    'js-variable-power': () => {
      mustMatch(sources.js, /let\s+power\s*=\s*\d+/i, 'JS_REGEX_NOT_MATCH', '需要声明 let power = 数值');
    },
    'js-if-gate': () => {
      mustMatch(sources.js, /if\s*\(\s*mana\s*>\s*50\s*\)/i, 'JS_REGEX_NOT_MATCH', '需要 if (mana > 50)');
    },
    'js-dom-query': () => {
      mustMatch(
        sources.js,
        /querySelector\s*\(\s*["']#door["']\s*\)/i,
        'JS_REGEX_NOT_MATCH',
        '需要使用 querySelector("#door")'
      );
    },
    'js-click-event': () => {
      mustMatch(
        sources.js,
        /addEventListener\s*\(\s*["']click["']/i,
        'JS_REGEX_NOT_MATCH',
        '需要绑定 click 事件'
      );
      mustMatch(sources.js, /textContent\s*=/i, 'JS_REGEX_NOT_MATCH', '点击后需要修改 textContent');
    },
    'project-todo-app': () => {
      if (!document.querySelector('input')) push('MISSING_SELECTOR', '需要输入框 input', { selector: 'input' });
      if (!document.querySelector('ul')) push('MISSING_SELECTOR', '需要列表 ul', { selector: 'ul' });
    },
    'project-localstorage': () => {
      mustMatch(
        sources.js,
        /localStorage\.setItem\s*\(/i,
        'JS_REGEX_NOT_MATCH',
        '需要调用 localStorage.setItem'
      );
    },
    'css-responsive-layout': () => {
      mustMatch(sources.css, /@media/i, 'CSS_REGEX_NOT_MATCH', '需要使用 @media');
      mustMatch(
        sources.css,
        /grid-template-columns\s*:\s*repeat\s*\(\s*2\s*,\s*1fr\s*\)/i,
        'CSS_REGEX_NOT_MATCH',
        '需要在媒体查询中设置双列 repeat(2, 1fr)'
      );
    },
    'css-animation-orb': () => {
      mustMatch(sources.css, /@keyframes/i, 'CSS_REGEX_NOT_MATCH', '需要定义 @keyframes');
      mustMatch(sources.css, /animation\s*:/i, 'CSS_REGEX_NOT_MATCH', '需要设置 animation 属性');
    },
    'js-array-map': () => {
      mustMatch(sources.js, /\.map\s*\(/i, 'JS_REGEX_NOT_MATCH', '需要使用 Array.map');
    },
    'js-async-await': () => {
      mustMatch(sources.js, /async\s+function/i, 'JS_REGEX_NOT_MATCH', '需要声明 async function');
      mustMatch(sources.js, /await\s+/i, 'JS_REGEX_NOT_MATCH', '需要使用 await');
    },
    'js-fetch-api': () => {
      mustMatch(sources.js, /fetch\s*\(/i, 'JS_REGEX_NOT_MATCH', '需要调用 fetch');
      mustMatch(sources.js, /\.json\s*\(/i, 'JS_REGEX_NOT_MATCH', '需要调用 .json() 解析响应');
    },
    'dom-form-validate': () => {
      mustMatch(
        sources.js,
        /addEventListener\s*\(\s*["']input["']/i,
        'JS_REGEX_NOT_MATCH',
        '需要监听 input 事件'
      );
      mustMatch(sources.js, /textContent\s*=/i, 'JS_REGEX_NOT_MATCH', '需要更新提示 textContent');
    },
    'dom-event-delegation': () => {
      mustMatch(
        sources.js,
        /addEventListener\s*\(\s*["']click["']/i,
        'JS_REGEX_NOT_MATCH',
        '需要监听 click 事件'
      );
      mustMatch(sources.js, /event\.target/i, 'JS_REGEX_NOT_MATCH', '需要使用 event.target 判断来源');
    },
    'project-timer-app': () => {
      mustMatch(sources.js, /setInterval\s*\(/i, 'JS_REGEX_NOT_MATCH', '需要使用 setInterval');
      mustMatch(sources.js, /clearInterval\s*\(/i, 'JS_REGEX_NOT_MATCH', '需要使用 clearInterval');
    },
  };

  const fn = checks[levelKey];
  if (!fn) return null;
  fn();
  return errors;

  function mustMatch(source, re, code, message) {
    if (!re.test(source || '')) {
      push(code, message, { pattern: re.source });
    }
  }
}

module.exports = {
  validateLevel,
};

