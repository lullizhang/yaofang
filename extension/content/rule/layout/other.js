; (async function () {

  const yawf = window.yawf;
  const util = yawf.util;
  const rule = yawf.rule;
  const observer = yawf.observer;
  const init = yawf.init;
  const message = yawf.message;

  const layout = yawf.rules.layout;

  const i18n = util.i18n;
  const css = util.css;

  const details = layout.details = {};

  i18n.detailsToolGroupTitle = {
    cn: '细节',
    tw: '細節',
    en: 'Details',
  };

  details.details = rule.Group({
    parent: layout.layout,
    template: () => i18n.detailsToolGroupTitle,
  });


  i18n.styleTextFontFamily = {
    cn: '替换网页字体为|西文{{west}}|中文{{chinese}}',
    tw: '替換網頁字形為|西文{{west}}|中文{{chinese}}',
    en: 'Customize fonts on webpage | Western {{west}} | Chinese {{chinese}}',
  };

  const supportedFonts = message.invoke.getSupportedFontList();

  layout.fontFamily = rule.Rule({
    id: 'font_family',
    version: 1,
    parent: details.details,
    template: () => i18n.styleTextFontFamily,
    ref: {
      west: {
        type: 'select',
        select: supportedFonts.then(fonts => (
          fonts.west.map(([cssName, name]) => ({ value: name, text: name }))
        )),
      },
      chinese: {
        type: 'select',
        select: supportedFonts.then(fonts => (
          fonts.chinese.map(([cssName, name]) => ({ value: name, text: name }))
        )),
      },
    },
    async ainit() {
      const west = this.ref.west.getConfig();
      const chinese = this.ref.chinese.getConfig();
      const fonts = await supportedFonts;
      const [westCssname] = fonts.west.find(([_, name]) => name === west);
      const [chineseCssname] = fonts.chinese.find(([_, name]) => name === chinese);
      css.append(`html body, html body.WB_macT, html body.WB_xpT, html .WB_webim { font-family: ${westCssname}, ${chineseCssname}; }`);
    },
  });

  Object.assign(i18n, {
    avatarShape: {
      cn: '统一头像形状为|{{shape}}',
      hk: '統一頭像形狀為|{{shape}}',
      en: 'Show all avatars as | {{shape}}',
    },
    avatarShapeCircle: {
      cn: '圆形',
      hk: '圓形',
      en: 'Circle',
    },
    avatarShapeSquare: {
      cn: '方形',
      en: 'Square',
    },
  });

  details.avatarShape = rule.Rule({
    id: 'layout_avatar_shape',
    version: 1,
    parent: details.details,
    template: () => i18n.avatarShape,
    ref: {
      shape: {
        type: 'select',
        initial: 'square',
        select: [
          { value: 'circle', text: () => i18n.avatarShapeCircle },
          { value: 'square', text: () => i18n.avatarShapeSquare },
        ],
      },
    },
    ainit() {
      const shape = this.ref.shape.getConfig();
      if (shape === 'square') {
        css.append(`.W_face_radius, .W_person_info .cover .headpic, .PCD_header .pf_photo, .PCD_header .photo_wrap, .PCD_header .pf_photo .photo, .PCD_user_a .picitems .pic_box, .PCD_connectlist .follow_box .mod_pic img, .PCD_ut_a .pic_box, .PCD_counter_b .pic_box, .WB_feed_v3 .WB_sonFeed .WB_face, .WB_feed_v3 .WB_sonFeed .WB_face .face img { border-radius: 0 !important; }`);
      } else {
        css.append(`img[usercard], .WB_face img { border-radius: 50% !important; }`);
      }
    },
  });

  Object.assign(i18n, {
    fastFace: { cn: '表情选择框优先列出常用及置顶表情|{{clear}}', tw: '表情選擇框優先列出常用及置頂表情|{{clear}}', en: 'List top and recent emoji on the top of emoji selector | {{clear}}' },
    fastFaceTop: { cn: '置顶', tw: '置頂', en: 'Top' },
    fastFaceTopNotice: { cn: '将下方表情拖放至此置顶', tw: '將下方表情拖放至此置頂', en: 'Drag emoji and drop here to sticky' },
    fastFaceRecent: { cn: '最近', tw: '最近', en: 'Recent' },
    fastFaceClear: { cn: '清空列表', tw: '清除清單', en: 'Clear List' },
  });

  details.fastFace = rule.Rule({
    id: 'layout_fast_face',
    version: 1,
    parent: details.details,
    template: () => i18n.fastFace,
    ref: Object.assign({}, ...['top', 'recent'].map(key => ({
      [key]: {
        initial: [],
        normalize(value) {
          const emptyList = Array(10).fill(null);
          if (!Array.isArray(value)) return emptyList;
          return value.filter(item => {
            if (item === null) return true;
            if (item && item.title && item.img && item.text) return true;
            return false;
          }).concat(emptyList).slice(0, 10);
        },
      },
    })), {
      clear: {
        render() {
          const container = document.createElement('div');
          container.innerHTML = '<a class="W_btn_b yawf-clear-face" href="javascript:;"><span class="W_f14"></span></a>';
          container.querySelector('span').textContent = i18n.fastFaceClear;
          container.firstChild.addEventListener('click', event => {
            if (!event.isTrusted) return;
            details.fastFace.ref.top.setConfig();
            details.fastFace.ref.recent.setConfig();
          });
          return container.firstChild;
        },
      },
    }),
    ainit() {
      const rule = this;
      // 显示一个表情；聊天窗口里面表情输入的格式和别的地方不一样
      const createFaceItem = function (face, isIm) {
        const li = document.createElement('li');
        if (!face) return li;
        li.title = face.title;
        li.setAttribute('action-data', `${isIm ? 'text' : 'insert'}=${face.text}`);
        li.setAttribute('action-type', isIm ? 'webim_phiz_face' : 'select');
        const img = li.appendChild(document.createElement('img'));
        img.src = face.img;
        return li;
      };
      /**
       * 将列表显示出来，调整顺序尽量保留已有的表情的位置
       * @param {HTMLUListElement} ul
       * @param {{title, text, img}[]} faceList
       * @param {boolean} isIm
       */
      const renderListKeepOld = function (ul, faceList, isIm) {
        const listItems = Array.from(ul.querySelectorAll('li'));
        const newFaceTitles = new Set(faceList.map(e => e && e.title).filter(t => t));
        const emptySlots = [];
        listItems.forEach(li => {
          const title = li.title;
          const existInNew = newFaceTitles.has(title);
          if (existInNew) newFaceTitles.delete(title);
          else if (li.title) {
            const newLi = createFaceItem(null, isIm);
            li.replaceWith(newLi);
            emptySlots.push(newLi);
          } else {
            emptySlots.push(li);
          }
        });
        [...newFaceTitles].forEach(title => {
          const face = faceList.find(face => face.title === title);
          emptySlots.shift().replaceWith(createFaceItem(face, isIm));
        });
      };
      /**
       * 将列表显示出来，不调整顺序可能修改已有的表情位置
       * @param {HTMLUListElement} ul
       * @param {{title, text}[]} faceList
       * @param {boolean} isIm
       */
      const renderListKeepIndex = function (ul, faceList, isIm) {
        const listItems = Array.from(ul.querySelectorAll('li'));
        faceList.forEach((face, index) => {
          const listItem = listItems[index];
          if (listItem.title === (face && face.title || '')) return;
          listItem.replaceWith(createFaceItem(face, isIm));
        });
      };
      const renderRecentList = function () {
        const lists = document.querySelectorAll('.yawf-face-recent ul');
        const faceList = rule.ref.recent.getConfig();
        lists.forEach(list => {
          renderListKeepOld(list, faceList, list.matches('.yawf-face-im *'));
        });
      };
      const renderTopList = function () {
        const lists = document.querySelectorAll('.yawf-face-top ul');
        const faceList = rule.ref.top.getConfig();
        lists.forEach(list => {
          renderListKeepIndex(list, faceList, list.matches('.yawf-face-im *'));
        });
      };
      /**
       * 从被点击的对象（图片或者列表项）得到表情的相关信息
       * @param {HTMLElement} target
       */
      const getFace = function (target) {
        const li = target.closest('li');
        try {
          const face = {
            title: li.title,
            text: new URLSearchParams(li.getAttribute('action-data')).get('insert'),
            img: li.querySelector('img').src,
          };
          if (!face.title || !face.text || !face.img) return null;
          return face;
        } catch (e) { return null; }
      };
      // 从列表中移除重复的项，并保留 10 个
      const removeDuplicate = function (faceList) {
        const faceTitle = new Set(), result = [];
        faceList.forEach(face => {
          if (!face || faceTitle.has(face.title)) return;
          faceTitle.add(face.title);
          result.push(face);
        });
        while (result.length < 10) result.push(null);
        return result.slice(0, 10);
      };
      // 在用户点击表情后更新最近使用的表情
      const updateRecent = function (event) {
        const face = getFace(event.target);
        if (!face) return;
        const recent = [face].concat(rule.ref.recent.getConfig());
        rule.ref.recent.setConfig(removeDuplicate(recent));
        renderRecentList();
      };
      /**
       * 使用拖拽置顶表情
       * @param {HTMLElement} container
       * @param {HTMLUListElement} ul
       */
      const dragFace = function (container, ul) {
        // 显示和隐藏提示拖拽的标语
        const notice = container.querySelector('.yawf-face-drop-area');
        const showNotice = function () { notice.style.display = 'block'; };
        const hideNotice = function () { notice.style.display = 'none'; };
        // 拖拽
        let dragging = null, listItems;
        container.addEventListener('dragstart', event => {
          dragging = getFace(event.target) || null;
          // 开始拖拽的时候，标记所有目的地为可编辑的
          listItems = Array.from(ul.childNodes);
          listItems.forEach(li => { li.setAttribute('contenteditable', 'true'); });
          showNotice();
        });
        container.addEventListener('mouseleave', () => { dragging = null; });
        notice.addEventListener('dragenter', () => { hideNotice(); });
        ul.addEventListener('dragenter', () => { hideNotice(); });
        container.addEventListener('dragend', () => { hideNotice(); });
        container.addEventListener('drop', event => {
          // 结束拖拽的时候恢复原样
          if (listItems) listItems.forEach(li => { li.removeAttribute('contenteditable'); }); listItems = null;
          const img_upload = document.querySelector('.send_weibo .img_upload');
          if (img_upload) img_upload.style.display = 'none';
          // 然后看看起止都在哪里
          if (dragging === null) return;
          event.preventDefault();
          event.stopPropagation();
          const current = event.target.closest('li');
          const index = Array.from(ul.childNodes).indexOf(current);
          // 把拽到的东西加到置顶里面去
          const list = rule.ref.top.getConfig(), old = list[index];
          const newList = list.map((face, i) => {
            if (i === index) return dragging;
            if (!face) return null;
            if (face.title === dragging.title) return old;
            return face;
          });
          rule.ref.top.setConfig(newList);
          renderTopList();
        });
        if (rule.ref.top.getConfig().some(e => e)) hideNotice();
      };
      // 监视新的表情框
      observer.dom.add(function faceFastObserver() {
        const tab = document.querySelector('.layer_faces .WB_minitab:first-child');
        if (!tab) return;
        const container = tab.parentNode;
        const wrap = document.createElement('div');
        wrap.innerHTML = '<div class="faces_list yawf-face-list" node-type="scrollView"><div class="yawf-face-top yawf-face-row" node-type="list"><span class="yawf-face-title"></span><ul class="yawf-face-items"><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul><span class="yawf-face-drop-area"></span></div><div class="yawf-face-recent yawf-face-row" node-type="list"><span class="yawf-face-title"></span><ul class="yawf-face-items"><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul></div></div>';
        const area = container.insertBefore(wrap.firstChild, tab);
        area.querySelector('.yawf-face-top span').textContent = i18n.fastFaceTop;
        area.querySelector('.yawf-face-drop-area').textContent = i18n.fastFaceTopNotice;
        area.querySelector('.yawf-face-recent span').textContent = i18n.fastFaceRecent;
        const topList = area.querySelector('.yawf-face-top ul');
        const recentList = area.querySelector('.yawf-face-recent ul');
        const chatListNode = container.querySelector('ul[node-type="_phizListNode"]');
        const isIm = chatListNode != null;
        container.addEventListener('click', updateRecent);
        dragFace(container, topList);
        if (isIm) {
          area.classList.add('yawf-face-im');
          fixChat([topList, recentList], chatListNode);
        }
        renderTopList();
        renderRecentList();
      });
      // 修理一下聊天窗口里面的情况
      // 我不确定这段代码还有没有用，总之先留着
      const fixChat = function (lists, chatListNode) {
        lists.forEach(list => {
          list.addEventListener('click', event => {
            event.stopPropagation();
            const target = event.target.closest('li');
            if (!target.title) return;
            // 弄一个假的按钮，放在原本的列表末尾，骗他说我点的是原本的列表里面的
            const fake = target.cloneNode(true);
            fake.style.display = 'none';
            chatListNode.appendChild(fake);
            fake.click();
            fake.parentNode.removeChild(fake);
          });
        });
      };
      css.append(`
.layer_faces .faces_list.yawf-face-list { height: 79px; }
.yawf-face-row { display: block; height: 32px; margin: 0 0 5px; }
.yawf-face-title { float: left; font-weight: bold; line-height: 32px; padding: 0; text-align: center; width: 52px; margin: 0 -8px 0 0; }
.yawf-face-items { float: right; margin: 0 8px; }
.yawf-face-items li { color: transparent; }
.yawf-face-drop-area { background: rgba(255, 255, 127, 0.5); clear: both; float: right; font-weight: bold; height: 32px; line-height: 32px; margin: -32px 8px 0; opacity: 1; padding: 0; width: 306px; text-align: center; }
.layer_faces .faces_list { -webkit-user-select: none; -moz-user-select: none; user-select: none; }
.layer_faces .faces_list li { overflow: hidden; }
.layer_faces .faces_list img { border: 10px transparent solid; margin: -10px; }
`);
    },
  });

  if (!(function isCst() {
    // 如果用户使用的是已经是和东八区一致的时区，那么我们就不提供这个功能了
    const year = new Date().getFullYear();
    return [...Array(366)].every((_, i) => new Date(year, 0, i).getTimezoneOffset() === -480);
  }())) {

    Object.assign(i18n, {
      useLocaleTimezone: {
        cn: '使用本机时区',
        tw: '使用本機時區',
        en: 'Use locale timezone',
      },
      timeToday: { cn: '今天', tw: '今天', en: 'Today' },
      timeSecondBefore: { cn: '秒前', tw: '秒前', en: ' secs ago' },
      timeMinuteBefore: { cn: '分钟前', tw: '分鐘前', en: ' mins ago' },
      timeMonthDay: { cn: '{1}月{2}日 {3}:{4}', en: '{1}-{2} {3}:{4}' },
      feedsRead: { cn: '你看到这里', tw: '你看到這裡', en: 'you got here' },
    });

    // 使用本地时区
    details.timezone = rule.Rule({
      id: 'layout_locale_timezone',
      version: 1,
      parent: details.details,
      template: () => i18n.useLocaleTimezone,
      ainit() {
        // $CONFIG.timeDiff 保存了本机时间与服务器时间的差，减去这个差值可得到服务器时间的近似值
        const now = () => new Date(Date.now() - ((init.page.$CONFIG || {}).timeDiff || 0));

        /**
         * @param {Date|number} time
         * @param {boolean?} locale
         * @returns {[string, string, string, string, string, string, string]}
         */
        const timeToParts = (time, locale = true) => (
          new Date(time - new Date(time).getTimezoneOffset() * 6e4 * locale)
            .toISOString().match(/\d+/g)
        );

        const formatTime = function (time) {
          const ref = now();
          const [iy, im, id, ih, iu] = timeToParts(time);
          const [ny, nm, nd, nh, nu] = timeToParts(ref);
          const diff = (ref - time) / 1e3;
          if (iy !== ny) {
            return `${iy}-${im}-${id} ${ih}:${iu}`;
          } else if (im !== nm || id !== nd) {
            return i18n.timeMonthDay.replace(/\{\d\}/g, n => [im, id, ih, iu][n[1] - 1]);
          } else if (ih !== nh && diff > 3600) {
            return `${i18n.timeToday} ${ih}:${iu}`;
          } else if (diff > 50) {
            return Math.ceil(diff / 60) + i18n.timeMinuteBefore;
          } else {
            return Math.max(Math.ceil(diff / 10), 1) * 10 + i18n.timeSecondBefore;
          }
        };

        const formatter = Intl.DateTimeFormat(
          { cn: 'zh-CN', hk: 'zh-HK', tw: 'zh-TW', en: 'en-US' }[util.language],
          {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'long',
          }
        );
        const formatTimeDetail = function (date) {
          return formatter.format(date);
        };

        const updateDate = function (element) {
          const date = parseInt(element.getAttribute('yawf-date'), 10);
          element.textContent = formatTime(date);
          element.title = formatTimeDetail(date);
        };

        const updateAllDate = function () {
          const dates = document.querySelectorAll('[yawf-date]');
          Array.from(dates).forEach(element => {
            updateDate(element);
          });
        };

        const handleDateElements = function handleDateElements() {
          const [feedListTimeTip, ...moreFeedListTimeTip] = document.querySelectorAll('[node-type="feed_list_timeTip"][date]');
          moreFeedListTimeTip.forEach(element => element.remove());
          if (feedListTimeTip) (function (tip) {
            const olds = document.querySelectorAll('[node-type="yawf-feed_list_timeTip"][date]');
            Array.from(olds).forEach(element => element.remove());
            tip.setAttribute('node-type', 'yawf-feed_list_timeTip');
            const date = parseInt(tip.getAttribute('date'), 10);
            tip.removeAttribute('date');
            tip.classList.add('yawf-feed_list_timeTip');
            tip.innerHTML = '<div class="WB_cardtitle_a W_tc"><a node-type="feed_list_item_date" style="color:inherit"></a></div>';
            const inner = tip.firstChild.firstChild;
            inner.setAttribute('yawf-date', date);
            inner.after(' ' + i18n.feedsRead);
          }(feedListTimeTip));

          const dateElements = Array.from(document.querySelectorAll('[date]'));
          dateElements.forEach(element => {
            const date = parseInt(element.getAttribute('date'), 10);
            element.setAttribute('yawf-date', date);
            element.removeAttribute('date');
          });

          if (feedListTimeTip || dateElements.length) updateAllDate();
        };

        observer.dom.add(handleDateElements);
        setInterval(updateAllDate, 1e3);

        const parseTextTime = function (text) {
          let parseDate = null;
          const now = Date.now();
          const [cy, cm, cd] = timeToParts(now);
          if (/^\d+-\d+-\d+ \d+:\d+$/.test(text)) {
            const [y, m, d, h, u] = text.match(/\d+/g);
            parseDate = Date.UTC(y, m - 1, d, h, u) - 288e5;
          } else if (/^(?:\d+-\d+|\d+月\d+日) \d+:\d+$/.test(text)) {
            const [m, d, h, u] = text.match(/\d+/g);
            parseDate = Date.UTC(cy, m - 1, d, h, u) - 288e5;
          } else if (/^(?:今天|today)\s*\d+:\d+$/i.test(text)) {
            const [h, u] = text.match(/\d+/g);
            parseDate = Date.UTC(cy, cm - 1, cd, h, u) - 288e5;
          } else if (/^\s*\d+\s*(?:分钟前|分鐘前|mins ago)/.test(text)) {
            const min = text.match(/\d+/g);
            parseDate = now - min * 6e4;
          } else if (/^\s*\d+\s*(?:秒前|secs ago)/.test(text)) {
            const sec = text.match(/\d+/g);
            parseDate = now - sec * 1e3;
          }
          return parseDate ? new Date(parseDate) : null;
        };

        // 处理文本显示的时间
        const handleTextDateElements = function changeDateText() {
          const selectors = [
            '.WB_from:not([yawf-localtime])',
            '.cont_top .data:not([yawf-localtime])',
            'legend:not([yawf-localtime])',
          ].join(',');
          const elements = Array.from(document.querySelectorAll(selectors));
          elements.forEach(element => {
            element.setAttribute('yawf-localtime', '');
            // 聊天窗口中的时间是本地的时间，但是其实现在已经没有聊天窗口了
            if (element.matches('.WB_webim *')) return;
            const textNode = element.firstChild;
            if (textNode.nodeType !== Node.TEXT_NODE) return;
            const text = textNode.textContent.trim();
            if (text === '') return;
            const [_full, match, tail] = text.match(/^(.*?)\s*(来自|來自|come from|)$/);
            const time = parseTextTime(match);
            if (!time) return;
            util.debug('parse time %o(%s) to %o(%s)', textNode, text, new Date(time), new Date(time));
            textNode.textContent = tail ? ` ${tail} ` : '';
            const timeElement = document.createElement('span');
            timeElement.setAttribute('yawf-date', time);
            updateDate(timeElement);
          });
        };

        observer.dom.add(handleTextDateElements);
      },
    });
  }

}());
