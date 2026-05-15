/**
 * RE:BOARD 3.0 - Global Advanced AI Recommendation Engine
 * Feature: Absolute Tier System, Gender Banishment, Context Pattern Matching
 * Default Tab Force: World News + Stable Random Advertisement & Infinite Scroll
 */

// =========================================================================
// [1] 전역 헬퍼 및 DOM 유틸리티
// =========================================================================
let macyInstances = { store: null, gallery: null, forum: null, code: null, news: null };

function toggleSearchMode(a){const n=document.getElementById('main-nav-bar'),i=document.getElementById('store-search-input');if(n&&i){a?(n.classList.add('search-mode'),setTimeout(()=>i.focus(),50)):(n.classList.remove('search-mode'),i.value='',i.blur(),window.$boardApp&&window.$boardApp.searchQuery!==''&&window.$boardApp.execSearch(''));}}
function toggleNewsSearchMode(a){const n=document.getElementById('board-news-nav-bar'),i=document.getElementById('news-search-input');if(n&&i){a?(n.classList.add('search-mode'),setTimeout(()=>i.focus(),50)):(n.classList.remove('search-mode'),i.blur());}}
function toggleCodeSearchMode(a){const n=document.getElementById('board-code-nav-bar'),i=document.getElementById('code-search-input');if(n&&i){a?(n.classList.add('search-mode'),setTimeout(()=>i.focus(),50)):(n.classList.remove('search-mode'),i.blur());}}
function toggleGallerySearchMode(a){const n=document.getElementById('board-gallery-nav-bar'),i=document.getElementById('gallery-search-input');if(n&&i){a?(n.classList.add('search-mode'),setTimeout(()=>i.focus(),50)):(n.classList.remove('search-mode'),i.blur());}}
function toggleForumSearchMode(a){const n=document.getElementById('board-forum-nav-bar'),i=document.getElementById('forum-search-input');if(n&&i){a?(n.classList.add('search-mode'),setTimeout(()=>i.focus(),50)):(n.classList.remove('search-mode'),i.blur());}}
function toggleStoreSearchMode(a){const n=document.getElementById('board-store-nav-bar'),i=document.getElementById('store-search-input');if(n&&i){a?(n.classList.add('search-mode'),setTimeout(()=>i.focus(),50)):(n.classList.remove('search-mode'),i.blur());}}

function doSearch(k){if(window.$boardApp)window.$boardApp.execSearch(k);}
function previewAppIcon(i){if(i.files&&i.files[0]){const r=new FileReader();r.onload=e=>{const pv=document.getElementById('app-icon-preview'),ph=document.getElementById('app-icon-placeholder');if(pv){pv.src=e.target.result;pv.classList.remove('hidden');}if(ph)ph.classList.add('hidden');};r.readAsDataURL(i.files[0]);}}
async function runApp(id){window.scrollTo({top:0,behavior:'smooth'});if(typeof showToast==='function')showToast("Loading...");if(typeof loadAppDetails==='function')await loadAppDetails(id);}
window.runApp = runApp;

(function initNotice(){const e=document.getElementById('board-spirit-notice');if(!e)return;const n=(window.__RE_BOARD3_CONFIG__&&window.__RE_BOARD3_CONFIG__.boardSpiritNoticeItems)||[];const s=n[Math.floor(Math.random()*n.length)];if(s){if(s.text)e.textContent=s.text;if(s.url)e.dataset.href=s.url;}const g=()=>{if(e.dataset.href)window.location.href=e.dataset.href;};e.addEventListener('click',g);setTimeout(()=>{e.classList.add('show');setTimeout(()=>{e.classList.add('fade-out');setTimeout(()=>{e.classList.remove('show','fade-out');e.style.display='none';},600);},2000);},500);})();

function buildGalleryShareContext(item) {
    const url = new URL(window.location.href);
    const shareId = item && (item.share_id || item.id) ? String(item.share_id || item.id) : '';
    if (shareId) url.searchParams.set('v', shareId);
    return {
        url: url.toString(),
        image: String(item && item.image_url ? item.image_url : ''),
        title: String((item && (item.nickname || item.safeIp || item.title || item.prompt)) || 'Gallery image'),
        description: String((item && (item.content || item.prompt || item.title)) || '').trim(),
        source: String((item && (item.nickname || item.safeIp)) || 'User')
    };
}
function shareGalleryToSocial(network) {
    const ctx = window.__RE_BOARD3_SHARE_CONTEXT__ || {};
    const pageUrl = encodeURIComponent(ctx.url || window.location.href);
    const title = encodeURIComponent(ctx.title || 'Gallery image');
    const image = encodeURIComponent(ctx.image || '');
    const description = encodeURIComponent(ctx.description || ctx.title || 'Gallery image');
    const shareUrls = {
        x: `https://twitter.com/intent/tweet?url=${pageUrl}&text=${title}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`,
        pinterest: `https://pinterest.com/pin/create/button/?url=${pageUrl}&media=${image}&description=${description}`,
        tumblr: `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${pageUrl}&title=${title}&caption=${description}&content=${image}`
    };
    const target = shareUrls[String(network || '').toLowerCase()];
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer,width=640,height=720');
}
window.shareGalleryToSocial = shareGalleryToSocial;

// =========================================================================
// [2] Alpine.js 애플리케이션
// =========================================================================
document.addEventListener('alpine:init', () => {
    Alpine.data('boardApp', () => ({
        curTab: (window.__RE_BOARD3_CONFIG__&&window.__RE_BOARD3_CONFIG__.initialBoardTab)||'news',
        newsCategories: (window.__RE_BOARD3_CONFIG__&&window.__RE_BOARD3_CONFIG__.newsCategories)||[],

        galleryCategories:[
            {key:'all', name:'All', icon:'ri-apps-line', q:''},
            {key:'anime', name:'Anime', icon:'ri-user-smile-line', q:'anime'},
            {key:'realistic', name:'Realistic', icon:'ri-camera-line', q:'realistic'},
            {key:'girl', name:'Girl', icon:'ri-women-line', q:'girl'},
            {key:'boy', name:'Boy', icon:'ri-men-line', q:'boy'},
            {key:'fantasy', name:'Fantasy', icon:'ri-magic-line', q:'fantasy'},
            {key:'scifi', name:'Sci-Fi', icon:'ri-rocket-line', q:'sci-fi'},
            {key:'cyberpunk', name:'Cyberpunk', icon:'ri-cpu-line', q:'cyberpunk'},
            {key:'landscape', name:'Landscape', icon:'ri-landscape-line', q:'landscape'},
            {key:'animal', name:'Animal', icon:'ri-bear-smile-line', q:'animal'},
            {key:'mecha', name:'Mecha', icon:'ri-robot-2-line', q:'mecha robot'},
            {key:'3d', name:'3D', icon:'ri-box-3-line', q:'3d'},
            {key:'sketch', name:'Sketch', icon:'ri-pencil-line', q:'sketch'}
        ],
        forumCategories:[
            {key:'all', name:'All', icon:'ri-apps-line', q:''},
            {key:'general', name:'General', icon:'ri-chat-1-line', q:'general'},
            {key:'humor', name:'Humor', icon:'ri-emotion-laugh-line', q:'humor'},
            {key:'info', name:'Info', icon:'ri-information-line', q:'info'},
            {key:'review', name:'Review', icon:'ri-star-line', q:'review'},
            {key:'qa', name:'Q&A', icon:'ri-question-answer-line', q:'question'},
            {key:'tip', name:'Tip', icon:'ri-lightbulb-flash-line', q:'tip'},
            {key:'news', name:'News', icon:'ri-newspaper-line', q:'news'},
            {key:'discussion', name:'Discussion', icon:'ri-discuss-line', q:'discussion'},
            {key:'feedback', name:'Feedback', icon:'ri-feedback-line', q:'feedback'},
            {key:'event', name:'Event', icon:'ri-calendar-event-line', q:'event'},
            {key:'notice', name:'Notice', icon:'ri-pushpin-line', q:'notice'},
            {key:'suggestion', name:'Suggestion', icon:'ri-mail-send-line', q:'suggestion'}
        ],
        storeCategories:[
            {key:'all', name:'All', icon:'ri-apps-line', q:''},
            {key:'general', name:'General', icon:'ri-apps-ai-line', q:'general'},
            {key:'character', name:'Character', icon:'ri-chat-ai-line', q:'character'},
            {key:'image', name:'Image', icon:'ri-image-edit-line', q:'image'},
            {key:'writing', name:'Writing', icon:'ri-quill-pen-line', q:'writing'},
            {key:'music', name:'Music', icon:'ri-music-line', q:'music'},
            {key:'video', name:'Video', icon:'ri-video-ai-line', q:'video'},
            {key:'code', name:'Code', icon:'ri-code-box-line', q:'code'},
            {key:'game', name:'Game', icon:'ri-gamepad-line', q:'game'},
            {key:'finance', name:'Finance', icon:'ri-money-dollar-circle-line', q:'finance'},
            {key:'education', name:'Education', icon:'ri-book-open-line', q:'education'},
            {key:'design', name:'Design', icon:'ri-brush-line', q:'design'},
            {key:'tool', name:'Tool', icon:'ri-tools-line', q:'tool'}
        ],
        codeCategories:[
            {key:'all', name:'All', icon:'ri-apps-line', q:''},
            {key:'frontend', name:'Frontend', icon:'ri-layout-masonry-line', q:'frontend'},
            {key:'backend', name:'Backend', icon:'ri-server-line', q:'backend'},
            {key:'ai', name:'AI', icon:'ri-brain-line', q:'ai'},
            {key:'database', name:'Database', icon:'ri-database-2-line', q:'database'},
            {key:'script', name:'Script', icon:'ri-file-code-line', q:'script'},
            {key:'tool', name:'Tool', icon:'ri-tools-line', q:'tool'},
            {key:'snippet', name:'Snippet', icon:'ri-scissors-cut-line', q:'snippet'},
            {key:'library', name:'Library', icon:'ri-book-3-line', q:'library'},
            {key:'framework', name:'Framework', icon:'ri-layout-4-line', q:'framework'},
            {key:'game', name:'Game', icon:'ri-gamepad-line', q:'game'},
            {key:'config', name:'Config', icon:'ri-settings-4-line', q:'config'},
            {key:'other', name:'Other', icon:'ri-more-2-line', q:'other'}
        ],

        newsQuery: '',
        selectedNewsCategoryQ: '',
        hasInitialNewsSearch: !!(window.__RE_BOARD3_CONFIG__&&window.__RE_BOARD3_CONFIG__.hasInitialNewsSearch),
        
        marketMode: '', selectedMarketSymbol: '', marketHeatmapActive: false,
        marketHeatmapLocale: (window.__RE_BOARD3_CONFIG__&&window.__RE_BOARD3_CONFIG__.marketHeatmapLocale)||'en',
        cryptoHeatmapLocale: 'en', marketHeatmapSource: 'SPX500',
        marketSymbolCatalog: {
            stocks:[{name:'AAPL',symbol:'NASDAQ:AAPL'},{name:'MSFT',symbol:'NASDAQ:MSFT'},{name:'AMZN',symbol:'NASDAQ:AMZN'},{name:'GOOGL',symbol:'NASDAQ:GOOGL'},{name:'NVDA',symbol:'NASDAQ:NVDA'},{name:'META',symbol:'NASDAQ:META'},{name:'TSLA',symbol:'NASDAQ:TSLA'}],
            gold:[{name:'XAUUSD',symbol:'OANDA:XAUUSD'},{name:'XAGUSD',symbol:'OANDA:XAGUSD'},{name:'GLD',symbol:'AMEX:GLD'}],
            crypto:[{name:'BTCUSDT',symbol:'BINANCE:BTCUSDT'},{name:'ETHUSDT',symbol:'BINANCE:ETHUSDT'},{name:'SOLUSDT',symbol:'BINANCE:SOLUSDT'},{name:'XRPUSDT',symbol:'BINANCE:XRPUSDT'},{name:'DOGEUSDT',symbol:'BINANCE:DOGEUSDT'}],
            commodities:[{name:'USOIL',symbol:'TVC:USOIL'},{name:'UKOIL',symbol:'TVC:UKOIL'},{name:'NATGAS',symbol:'NYMEX:NG1!'}]
        },

        selectedCodeCategory: 'all', selectedGalleryCategory: 'all', selectedForumCategory: 'all', selectedStoreCategory: 'all',
        currentTag: new URLSearchParams(window.location.search).get('tag')||'', 
        searchQuery: '', storeQuery: '', galleryQuery: '', forumQuery: '', codeQuery: '',
        
        items: { widgets:[], store:[], gallery:[], forum:[], code:[], news:[], products:[] }, 
        page: { store:1, gallery:1, forum:1, code:1, news:1 },
        loading: { store:false, gallery:false, forum:false, code:false, news:false }, 
        end: { store:false, gallery:false, forum:false, code:false, news:false },
        warmupDone: { store:false, gallery:false, forum:false, code:false, news:false }, 
        initialInterestSortDone: { store:false, gallery:false, forum:false, code:false, news:false },
        
        interestProfile: {}, productProfile: {}, marketProfile: {}, itemProfile: {},
        galleryModal: { open: false, item: null },

        decodeEscapedText(val) {
            if(typeof val!=='string'||!val)return val||''; if(!val.includes('\\u'))return val;
            let v=val.replace(/\\\\u/g,'\\u').replace(/\\u([0-9a-fA-F]{4})/g,(_,x)=>String.fromCharCode(parseInt(x,16)));
            return v.replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\');
        },
        normalizeCategoryStrings() {
            if(Array.isArray(this.newsCategories)) this.newsCategories=this.newsCategories.map(c=>({...c,name:this.decodeEscapedText(c.name),q:this.decodeEscapedText(c.q)}));
            if(Array.isArray(this.codeCategories)) this.codeCategories=this.codeCategories.map(c=>({...c,name:this.decodeEscapedText(c.name)}));
        },

        // --- Market Widget ---
        getNewsMarketMode(q) {
            q=String(q||'').toLowerCase(); if(!q)return'';
            if(/(crypto|bitcoin|btc|ethereum|eth|xrp|sol|doge|코인|가상화폐|암호화폐)/i.test(q))return'crypto';
            if(/(금|골드|은|xau|gold|xag|silver)/i.test(q))return'gold';
            if(/(원자재|원유|wti|brent|천연가스|구리|oil|gas|copper)/i.test(q))return'commodities';
            if(/(주식|증시|코스피|나스닥|s&p|sp500|stock|market|nasdaq|aapl|nvda|msft|tsla)/i.test(q))return'stocks';
            return '';
        },
        syncMarketWidgetMode(fReset=false) {
            const pM=this.marketMode; this.marketMode=this.getNewsMarketMode(this.newsQuery||this.selectedNewsCategoryQ);
            if(!this.marketMode){ this.selectedMarketSymbol=''; this.marketHeatmapActive=false; return; }
            let syms=this.marketSymbolCatalog[this.marketMode]||[];
            if(!this.supportsHeatmapMode()) this.marketHeatmapActive=false;
            if(fReset||!syms.some(s=>s.symbol===this.selectedMarketSymbol)){
                const sortedSyms = syms.slice().sort((a,b) => (this.marketProfile[b.symbol]||0) - (this.marketProfile[a.symbol]||0));
                this.selectedMarketSymbol=sortedSyms.length?sortedSyms[0].symbol:'';
            }
            if(this.supportsHeatmapMode()){ this.marketHeatmapActive=true; this.$nextTick(()=>this.renderMarketHeatmapWidget(fReset||pM!==this.marketMode)); }
        },
        shouldShowMarketWidget(){ return this.curTab==='news'&&!!this.marketMode; },
        supportsHeatmapMode(m=null){ return (m||this.marketMode)==='stocks'||(m||this.marketMode)==='crypto'; },
        shouldShowHeatmapWidget(){ return this.supportsHeatmapMode()&&this.marketHeatmapActive; },
        getActiveMarketSymbols(){ return this.marketSymbolCatalog[this.marketMode]||[]; },
        getMarketSymbolToken(s){ return String(s?.name||'').slice(0,3).toUpperCase() || 'TV'; },
        getMarketSymbolAvatar(s){ const t=this.getMarketSymbolToken(s); return `https://ui-avatars.com/api/?name=${encodeURIComponent(t)}&background=111827&color=fff&bold=true&format=svg&size=64`; },
        showMarketHeatmap(){ if(this.supportsHeatmapMode()){ this.marketHeatmapActive=true; this.$nextTick(()=>this.renderMarketHeatmapWidget(true)); } },
        setMarketSymbol(s){ 
            if(s){ 
                this.selectedMarketSymbol=s; if(this.supportsHeatmapMode())this.marketHeatmapActive=false; 
                this.marketProfile[s] = Math.min(1000, (this.marketProfile[s] || 0) + 1);
                localStorage.setItem('isai_market_profile_v1', JSON.stringify(this.marketProfile));
            } 
        },
        isActiveMarketSymbol(s){ return !this.marketHeatmapActive&&this.selectedMarketSymbol===s; },
        renderMarketHeatmapWidget(f=false){
            if(!this.supportsHeatmapMode())return; const h=this.$refs.marketHeatmapWidget, m=String(this.marketMode||''); if(!h||(!f&&h.dataset.loaded==='1'&&h.dataset.mode===m))return;
            h.innerHTML=''; h.dataset.loaded='0'; h.dataset.mode=m;
            const wrap = document.createElement('div');
            wrap.className = 'tradingview-widget-container market-heatmap-container';
            const widget = document.createElement('div');
            widget.className = 'tradingview-widget-container__widget market-heatmap-widget';
            wrap.appendChild(widget);
            let scr=document.createElement('script'); scr.type='text/javascript'; scr.async=true;
            if(m==='crypto'){
                scr.src='https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js';
                scr.text=JSON.stringify({dataSource:'Crypto',blockSize:'market_cap_calc',blockColor:'24h_close_change|5',locale:this.cryptoHeatmapLocale||'en',colorTheme:'dark',hasTopBar:false,isDataSetEnabled:false,isZoomEnabled:true,hasSymbolTooltip:true,width:'100%',height:'100%'});
            } else {
                scr.src='https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
                scr.text=JSON.stringify({exchanges:[],dataSource:this.marketHeatmapSource||'SPX500',blockSize:'market_cap_basic',blockColor:'change',grouping:'sector',locale:this.marketHeatmapLocale||'en',colorTheme:'dark',hasTopBar:false,isDataSetEnabled:false,isZoomEnabled:true,hasSymbolTooltip:true,width:'100%',height:'100%'});
            }
            scr.onload=()=>{h.dataset.loaded='1'; h.dataset.mode=m; this.$nextTick(()=>this.fixMarketHeatmapHeight());};
            wrap.appendChild(scr);
            h.appendChild(wrap);
            setTimeout(()=>this.fixMarketHeatmapHeight(), 600);
            setTimeout(()=>this.fixMarketHeatmapHeight(), 1600);
        },
        fixMarketHeatmapHeight(){
            const h=this.$refs.marketHeatmapWidget;
            if(!h)return;
            h.querySelectorAll('.tradingview-widget-container,.tradingview-widget-container__widget,iframe').forEach(el=>{
                el.style.width='100%';
                el.style.height='100%';
                el.style.minHeight='100%';
                el.style.display='block';
            });
        },
        getTradingViewChartUrl(){ const fb={stocks:'SP:SPX',gold:'OANDA:XAUUSD',crypto:'BINANCE:BTCUSDT',commodities:'TVC:USOIL'}[this.marketMode]||'SP:SPX'; return `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(this.selectedMarketSymbol||fb)}&interval=60&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=111111&theme=dark&style=1&timezone=Asia%2FSeoul&withdateranges=1&hideideas=1`; },

        // =========================================================================
        // [강력 최적화] AI 절대 티어(Tier) 시스템 
        // =========================================================================
        calculateItemTier(tb, i, targetKey) {
            if (!targetKey || targetKey === 'all') return 2; 

            const itemText = String(`${i?.title||''} ${i?.cleanTitle||''} ${i?.content||''} ${i?.snippet||''} ${i?.prompt||''} ${i?.keywords||''} ${i?.listText||''} ${i?.category||''}`).toLowerCase();
            
            let isMatch = i?.category ? i.category.toLowerCase().includes(targetKey) : false;
            let isConflict = false;

            const regexes = {
                boy: /\b(1boy|boys?|man|men|male|guy|handsome|chico|ni[ñn]o|hombre|var[oó]n|masculino|guapo)\b|(남자|소년|남성|남캐|男|男子|少年|男性|イケメン|लड़का|आदमी|पुरुष)/i,
                girl: /\b(1girl|girls?|woman|women|female|lady|beautiful|maid|waifu|chica|ni[ñn]a|mujer|hembra|femenina|hermosa|linda)\b|(여자|소녀|여성|여캐|女|女子|少女|女性|美少女|メイド|かわいい|लड़की|महिला|औरत|सुंदर|प्यारी)/i,
                anime: /\b(anime|manga|toon|waifu|2d|illustration|dibujo animado)\b|(애니|만화|일러스트|アニメ|マンガ|イラスト|二次元|एनिमे|मंगा|कार्टून)/i,
                realistic: /\b(realistic|photo|cinematic|real|raw|photorealistic|realista|fotograf[ií]a)\b|(실사|사진|포토|리얼|リアル|写真|実写|シネマティック|यथार्थवादी|फोटो|असली)/i,
                fantasy: /\b(fantasy|magic|dragon|elf|fantas[ií]a)\b|(판타지|마법|엘프|ファンタジー|魔法|कल्पना|जादू)/i,
                scifi: /\b(sci-fi|cyberpunk|space|robot|mecha)\b|(sf|사이버펑크|우주|메카|로봇|サイバーパンク|宇宙|ロボット|अंतरिक्ष|रोबोट)/i,
                landscape: /\b(landscape|scenery|background|nature|paisaje|naturaleza)\b|(풍경|배경|자연|風景|背景|自然|परिदृश्य|प्रकृति)/i,
                cyberpunk: /\b(cyberpunk|neon|synthwave|futuristic|ciberpunk)\b|(사이버펑크|네온|미래|サイバーパンク|ネオン|미래도시)/i,
                animal: /\b(animal|pet|cat|dog|bird|animales)\b|(동물|고양이|강아지|개|새|펫|動物|ペット|猫|犬|जानवर|पालतू)/i,
                mecha: /\b(mecha|robot|cyborg|meca)\b|(메카|로봇|사이보그|メカ|ロボット|サイボーグ|मेचा|रोबोट)/i,
                '3d': /\b(3d|render|octane|unreal|blender|c4d)\b|(3디|렌더링|3DCG)/i,
                sketch: /\b(sketch|drawing|pencil|boceto|dibujo)\b|(스케치|드로잉|연필|데생|スケッチ|デッサン|鉛筆|स्केच|ड्राइंग)/i,
                qa: /\b(qna|q&a|how to|help|question|pregunta|ayuda|duda)\b|\?|(질문|도움|어떻게|궁금|알려|質問|助けて|教えて|प्रश्न|सवाल|मदद)/i,
                humor: /\b(humor|funny|meme|lol|haha|gracioso|jaja|divertido)\b|(유머|웃긴|밈|ㅋㅋㅋ|ㅎㅎㅎ|재밌|폭소|ユーモア|面白い|笑|草|www|हास्य|मज़ाकिया|मीम)/i,
                review: /\b(review|evaluate|recommend|bought|rese[ñn]a|opini[oó]n)\b|(리뷰|후기|평가|추천|사용기|써본|샀|구매|장단점|レビュー|感想|評価|おすすめ|購入|समीक्षा|राय)/i,
                info: /\b(info|tip|guide|tutorial|consejo|gu[ií]a)\b|(팁|정보|지식|꿀팁|알아보기|방법|가이드|정리|情報|ヒント|ガイド|コツ|जानकारी|सुझाव)/i,
                discussion: /\b(discussion|debate|opinion|discusión)\b|(토론|의견|생각|논의|議論|意見|चर्चा|बहस)/i,
                news: /\b(news|article|press|journal|noticias)\b|(뉴스|기사|보도|소식|속보|ニュース|記事|報道|समाचार)/i,
                feedback: /\b(feedback|report|comentarios)\b|(피드백|건의|리포트|오류|피드백|フィードバック|보고|प्रतिक्रिया)/i,
                event: /\b(event|contest|giveaway|evento)\b|(이벤트|행사|대회|참여|공모전|イベント|コンテスト|행사|आयोजन)/i,
                notice: /\b(notice|announcement|update|aviso)\b|(공지|안내|업데이트|공지사항|알림|お知らせ|通知|सूचना)/i,
                suggestion: /\b(suggest|idea|proposal|sugerencia)\b|(건의|제안|아이디어|건의사항|提案|アイデア|सुझाव)/i,
                character: /\b(character|bot|ai_chat|chat|persona|personaje)\b|(챗봇|캐릭터|페르소나|대화|キャラクター|ボット|チャット|चरित्र|बॉट|चैट)/i,
                image: /\b(image|art|photo|draw|generate|imagen|arte)\b|(이미지|그림|사진|생성|합성|画像|アート|描く|छवि|चित्र)/i,
                writing: /\b(write|blog|story|novel|text|escritura)\b|(글쓰기|블로그|소설|작성|글|스토리|執筆|ブログ|小説|लिखना|कहानी)/i,
                music: /\b(music|audio|song|sound|suno|m[uú]sica)\b|(음악|노래|오디오|사운드|수노|音楽|曲|オーディオ|संगीत|गाना)/i,
                video: /\b(video|motion|animate|v[ií]deo)\b|(비디오|영상|동영상|모션|애니메이트|ビデオ|動画|वीडियो)/i,
                education: /\b(edu|learn|study|school|educaci[oó]n)\b|(교육|공부|학습|강의|배우기|학교|教育|学習|学ぶ|शिक्षा|अध्ययन)/i,
                design: /\b(design|ui|ux|layout|dise[ñn]o)\b|(디자인|디자이너|레이아웃|꾸미기|デザイン|レイアウト|डिज़ाइन)/i,
                code: /\b(code|dev|script|program|c[oó]digo|desarrollo)\b|(개발|코드|프로그래밍|코드생성|코딩|コード|開発|スクリプト|プログラム|कोड|विकास)/i,
                database: /\b(db|sql|mysql|nosql|mongo|postgres|database)\b|(데이터베이스|디비|데이터|データベース|डेटाबेस)/i,
                library: /\b(lib|library|package|npm|pip|librer[ií]a)\b|(라이브러리|패키지|모듈|ライブラリ|パッケージ|पुस्तकालय)/i,
                framework: /\b(framework|react|vue|angular|django|spring|laravel)\b|(프레임워크|프레임웍|フレームワーク|फ्रेमवर्क)/i,
                config: /\b(config|setup|setting|json|yaml|env|configuraci[oó]n)\b|(설정|환경|세팅|구성|設定|コンフィグ|सेटिंग)/i,
                finance: /\b(finance|money|stock|crypto|finanzas)\b|(금융|주식|돈|코인|경제|비트코인|증시|金融|株|仮想通貨|वित्त|पैसा)/i,
                game: /\b(game|play|gaming|juego)\b|(게임|오락|플레이|ゲーム|プレイ|खेल)/i,
                tool: /\b(tool|utility|herramienta|utilidad)\b|(도구|유틸|툴|ツール|ユーティリティ|उपकरण)/i,
                other: /\b(other|misc|etc|otros)\b|(기타|잡동사니|그외|その他|기타등등|अन्य)/i
            };

            if (regexes[targetKey] && regexes[targetKey].test(itemText)) isMatch = true;

            if (tb === 'gallery') {
                const hasBoy = regexes.boy.test(itemText);
                const hasGirl = regexes.girl.test(itemText);
                if (targetKey === 'boy' && hasGirl) isConflict = true; 
                if (targetKey === 'girl' && hasBoy) isConflict = true; 
            }

            if (isConflict) return 0; 
            if (isMatch) return 2;    
            return 1;                 
        },

        scoreByInterestBase(tb, i) {
            let s = 0;
            const itemText = String(`${i?.title||''} ${i?.cleanTitle||''} ${i?.content||''} ${i?.snippet||''} ${i?.listText||''} ${i?.prompt||''} ${i?.category||''} ${i?.keywords||''} ${i?.description||''} ${i?.source||''}`).toLowerCase();
            Object.keys(this.interestProfile).forEach(k => {
                if(k.startsWith('kw_') && itemText.includes(k.replace('kw_',''))) {
                    s += (this.interestProfile[k] * 10);
                }
            });
            const uid = i?.id || i?.link;
            if (uid && this.itemProfile[`${tb}_${uid}`]) {
                s += (Number(this.itemProfile[`${tb}_${uid}`]) * 100);
            }
            return s;
        },

        sortItemsByInterest(tb, l) { 
            if (!Array.isArray(l) || l.length < 2) return l;

            const catMap = { store: this.selectedStoreCategory, gallery: this.selectedGalleryCategory, forum: this.selectedForumCategory, code: this.selectedCodeCategory };
            const targetKey = (tb === 'news' ? this.selectedNewsCategoryQ : catMap[tb])?.toLowerCase() || '';

            return [...l].sort((a, b) => {
                const tierA = this.calculateItemTier(tb, a, targetKey);
                const tierB = this.calculateItemTier(tb, b, targetKey);
                if (tierA !== tierB) return tierB - tierA; 

                const scoreA = tb === 'products' ? this.scoreProduct(a) : this.scoreByInterestBase(tb, a);
                const scoreB = tb === 'products' ? this.scoreProduct(b) : this.scoreByInterestBase(tb, b);
                if (scoreA !== scoreB) return scoreB - scoreA; 
                
                const timeA = Date.parse(a.date || a.created_at || '') || 0;
                const timeB = Date.parse(b.date || b.created_at || '') || 0;
                if (timeA !== timeB) return timeB - timeA;

                const getId = x => x.id ? Number(x.id) : (x.link ? parseInt(String(x.link).replace(/\D/g, '').slice(0,8)) : 0);
                return getId(b) - getId(a);
            }); 
        },
        
        applyInterestSort(tb){ 
            if(tb === 'news') return; 
            if(['store','code','forum','gallery','products'].includes(tb)) {
                this.items[tb] = [...this.sortItemsByInterest(tb, this.items[tb])]; 
            }
        },

        trackItem(tb, i){
            if(!i || (!i.id && !i.link)) return;
            const uid = i.id || i.link;
            const k = `${tb}_${uid}`;
            this.itemProfile[k] = Math.min(1000, (this.itemProfile[k] || 0) + 1);
            localStorage.setItem('isai_item_profile_v1', JSON.stringify(this.itemProfile));
            setTimeout(() => { if (this.items[tb]?.length) { this.applyInterestSort(tb); this.updateMacy(tb); } }, 300);
        },
        trackInterest(tb, i, w=1){ 
            const text = String(`${i?.title||''} ${i?.cleanTitle||''} ${i?.content||''} ${i?.snippet||''} ${i?.listText||''} ${i?.prompt||''} ${i?.category||''} ${i?.keywords||''} ${i?.description||''} ${i?.source||''}`).toLowerCase();
            const words = text.replace(/[^a-z0-9가-힣_]+/g, ' ').split(/\s+/).filter(x=>x.length>1).slice(0,10);
            let u = false;
            words.forEach(k => { 
                const pKey = `kw_${k}`;
                this.interestProfile[pKey] = Math.min(500, Math.max(0, (this.interestProfile[pKey]||0) + w)); 
                u = true; 
            }); 
            if(u){
                localStorage.setItem('isai_interest_profile_v1',JSON.stringify(this.interestProfile));
                clearTimeout(this.sponsorSearchTimer);
                this.sponsorSearchTimer = setTimeout(() => this.loadSearchProducts?.(), 250);
            } 
        },
        
        productPriceLabel(i){ const cur=String(i?.currency||'KRW').toUpperCase(); const n=Number(i?.price||0); return cur==='USD'?'$'+n.toLocaleString(undefined,{maximumFractionDigits:2}):Math.round(n).toLocaleString()+'원'; },
        scoreProduct(i){ return this.scoreByInterestBase('products',i)+(Number(this.productProfile[i?.id]||0)*100)+(Number(i?.sort_order||0)); },
        
        isProductSearchMode() {
            // 카테고리 클릭이 아닌, 실제 검색어가 입력된 상태인지 탭별로 정확히 구분
            if (this.curTab === 'news') return !!this.newsQuery && this.newsQuery !== this.selectedNewsCategoryQ;
            if (this.curTab === 'store') return !!this.storeQuery;
            if (this.curTab === 'forum') return !!this.forumQuery;
            if (this.curTab === 'code') return !!this.codeQuery;
            if (this.curTab === 'gallery') return !!this.galleryQuery;
            return !!this.searchQuery;
        },
        getVisibleProducts(){
            const limit = this.isProductSearchMode() ? 24 : 3;
            return Array.isArray(this.items.products) 
                ? this.items.products.slice().sort((a,b)=>this.scoreProduct(b)-this.scoreProduct(a)||(Number(b.id||0)-Number(a.id||0))).slice(0,limit)
                : [];
        },
        getVisibleNewsItems(){ return Array.isArray(this.items.news) ? this.items.news :[]; },

        getMixedItems(tb) {
            const visibleItems = tb === 'news' ? this.getVisibleNewsItems() : (this.items[tb] || []);
            if (!visibleItems.length) return [];
            
            const original = visibleItems.map((item, idx) => ({type: tb, item, key: `${tb}-${item.id || item.link || idx}`}));
            const products = this.getVisibleProducts().map((item) => ({type: 'product', item, key: `product-${item.id}`, score: this.scoreProduct(item)}));
            
            if (!products.length) return original;
            
            const out = [];
            let pQueue = [...products].sort((a, b) => b.score - a.score);
            const isSearch = this.isProductSearchMode();
            
            // 시드 기반 난수 생성 (화면 깜빡임 완벽 방지)
            const getSeed = (str) => {
                let h = 0; for(let i=0; i<str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0; return Math.abs(h);
            };

            original.forEach((entry, idx) => {
                out.push(entry);
                let seed = getSeed(entry.key);
                let insertCount = 0;

                if (isSearch) {
                    // [검색 모드] 상품이 최대 33개이므로 일반 게시물 사이마다 1~2개씩 촘촘하게 섞음
                    insertCount = (seed % 10) < 4 ? 2 : 1; // 40% 확률로 2개, 60% 확률로 1개 삽입
                } else {
                    // [일반 모드] 기본 광고 3개이므로 2, 6, 11번째 위치와 드물게(30%) 1개씩 삽입
                    let forceInsert = (idx === 2 || idx === 6 || idx === 11);
                    if (forceInsert || (idx >= 1 && (seed % 10) < 3)) {
                        insertCount = 1;
                    }
                }

                // 큐에 상품이 남아있고 넣어야 할 카운트가 있으면 빼서 삽입
                while (pQueue.length > 0 && insertCount > 0) {
                    out.push(pQueue.shift());
                    insertCount--;
                }
            });
            
            // 위에서 다 섞지 못하고 남은 상품/광고가 있다면 맨 뒤에 추가
            while(pQueue.length > 0) {
                out.push(pQueue.shift());
            }
            return out;
        },

        setGalleryCat(c){
            this.selectedGalleryCategory = c.key;
            const hadSearchQuery = !!String(this.galleryQuery || '').trim();
            this.galleryQuery = '';
            document.getElementById('gallery-search-input').value='';
            toggleGallerySearchMode(false);

            if (hadSearchQuery || !this.items.gallery.length) {
                this.page.gallery=1;
                this.end.gallery=false;
                this.items.gallery=[];
                this.loadData('gallery');
            } else {
                this.applyInterestSort('gallery');
                this.updateMacy('gallery');
            }
            this.loadSearchProducts();
        },
        submitGallerySearch(k){ this.galleryQuery=String(k||'').trim(); this.selectedGalleryCategory=''; this.items.gallery=[]; this.page.gallery=1; this.end.gallery=false; this.loadData('gallery'); this.loadSearchProducts(); },
        resetGalleryCategory(){ this.selectedGalleryCategory='all'; this.galleryQuery=''; document.getElementById('gallery-search-input').value=''; toggleGallerySearchMode(false); this.items.gallery=[]; this.page.gallery=1; this.end.gallery=false; this.loadData('gallery'); this.loadSearchProducts(); },

        setForumCat(c){
            this.selectedForumCategory = c.key; this.forumQuery = ''; 
            this.applyInterestSort('forum'); this.updateMacy('forum');
            document.getElementById('forum-search-input').value=''; toggleForumSearchMode(false);
            this.page.forum=1; this.end.forum=false; this.items.forum=[]; this.loadData('forum'); this.loadSearchProducts();
        },
        submitForumSearch(k){ this.forumQuery=String(k||'').trim(); this.selectedForumCategory=''; this.items.forum=[]; this.page.forum=1; this.end.forum=false; this.loadData('forum'); this.loadSearchProducts(); },
        resetForumCategory(){ this.selectedForumCategory='all'; this.forumQuery=''; document.getElementById('forum-search-input').value=''; toggleForumSearchMode(false); this.items.forum=[]; this.page.forum=1; this.end.forum=false; this.loadData('forum'); this.loadSearchProducts(); },

        setStoreCat(c){
            this.selectedStoreCategory = c.key; this.storeQuery = '';
            this.applyInterestSort('store'); this.updateMacy('store');
            document.getElementById('store-search-input').value=''; toggleStoreSearchMode(false);
            this.page.store=1; this.end.store=false; this.items.store=[]; this.loadData('store'); this.loadSearchProducts();
        },
        submitStoreSearch(k){ this.storeQuery=String(k||'').trim(); this.selectedStoreCategory=''; this.items.store=[]; this.page.store=1; this.end.store=false; this.loadData('store'); this.loadSearchProducts(); },
        resetStoreCategory(){ this.selectedStoreCategory='all'; this.storeQuery=''; document.getElementById('store-search-input').value=''; toggleStoreSearchMode(false); this.items.store=[]; this.page.store=1; this.end.store=false; this.loadData('store'); this.loadSearchProducts(); },

        setNewsCat(c){ 
            this.selectedNewsCategoryQ = this.newsQuery = c.q; 
            this.syncMarketWidgetMode(true); window.history.replaceState({},'','/'); 
            this.items.news =[]; this.items.products =[]; 
            this.applyInterestSort('news'); this.updateMacy('news');
            document.getElementById('news-search-input').value=''; toggleNewsSearchMode(false); 
            this.page.news=1; this.end.news=false; this.loadData('news'); this.loadSearchProducts(); 
        },
        submitNewsSearch(k){ k=String(k||'').trim(); if(!k)return this.resetNewsCategory(); this.selectedNewsCategoryQ=''; this.newsQuery=k; this.syncMarketWidgetMode(true); window.history.replaceState({},'',`/search/${encodeURIComponent(k)}`); this.items.news=[]; this.items.products=[]; this.page.news=1; this.end.news=false; toggleNewsSearchMode(false); this.loadData('news'); this.loadSearchProducts(); },
        resetNewsCategory(){ if(this.newsCategories.length)this.setNewsCat(this.newsCategories[0]); },
        
        setCodeCat(c){ 
            this.selectedCodeCategory = c.key; this.codeQuery = '';
            this.applyInterestSort('code'); this.updateMacy('code');
            document.getElementById('code-search-input').value=''; toggleCodeSearchMode(false); 
            this.page.code=1; this.end.code=false; this.items.code=[]; this.loadData('code'); this.loadSearchProducts();
        },
        submitCodeSearch(k){ this.codeQuery=String(k||'').trim(); this.selectedCodeCategory=''; this.items.code=[]; this.page.code=1; this.end.code=false; this.loadData('code'); this.loadSearchProducts(); },
        resetCodeCategory(){ this.selectedCodeCategory='all'; this.codeQuery=''; document.getElementById('code-search-input').value=''; toggleCodeSearchMode(false); this.items.code=[]; this.page.code=1; this.end.code=false; this.loadData('code'); this.loadSearchProducts(); },

        openStoreItem(i){ if(i){ this.trackItem('store', i); this.trackInterest('store',i,2); const appId = i.id || i.app_id || i.appId; if(appId && typeof window.runApp==='function') window.runApp(appId); } },
        openForumItem(i){ if(i){ this.trackItem('forum', i); this.trackInterest('forum',i,2); window.location.href='https://isai.kr/view/'+i.id; } },
        openNewsGate(i){ if(i?.link){ this.trackItem('news', i); this.trackInterest('news',i,3); window.location.href=`/news_gate/?u=${encodeURIComponent(i.link)}&t=${encodeURIComponent(i.cleanTitle||i.title||'News')}&s=${encodeURIComponent(i.snippet||'')}`; } },
        openProduct(i){ if(i){ this.trackItem('products', i); this.trackInterest('products',i,3); this.productProfile[i.id]=Number(this.productProfile[i.id]||0)+1; localStorage.setItem('isai_product_profile_v1',JSON.stringify(this.productProfile)); if(i.link_url) window.open(i.link_url,'_blank','noopener'); } },
        async openCodeItem(i){ if(!i)return; this.trackItem('code', i); this.trackInterest('code',i,2); if(i.id){ window.location.href='/play_run/?id='+i.id; return; } if(i.run_url)window.open(i.run_url,'_blank','noopener'); else if(i.gist_url)window.open(i.gist_url,'_blank','noopener'); },
        openCodeComposer(){ window.scrollTo({top:0,behavior:'smooth'}); if(typeof window.setMode==='function')window.setMode('code'); },
        
        openGalleryItem(i){ 
            if(i){ 
                this.trackItem('gallery', i); this.trackInterest('gallery',i,2); 
                fetch('re_store.php?action=increase_view&id='+i.id).catch(e=>{}); 
                this.galleryModal.item = i; this.galleryModal.open = true;
                window.__RE_BOARD3_SHARE_CONTEXT__ = buildGalleryShareContext(i);
                const nextUrl = new URL(window.location.href); nextUrl.searchParams.set('v', i.share_id || i.id); window.history.pushState({}, '', nextUrl.toString());
            } 
        },
        closeGalleryModal() {
            this.galleryModal.open = false; setTimeout(() => { this.galleryModal.item = null; }, 300);
            window.__RE_BOARD3_SHARE_CONTEXT__ = null;
            const nextUrl = new URL(window.location.href); nextUrl.searchParams.delete('v'); window.history.pushState({}, '', nextUrl.pathname + nextUrl.search);
        },

        async openCharacterChat(i) {
            if(!i?.image_url) return; 
            this.trackItem('gallery', i); this.trackInterest('gallery', i, 3); 
            this.closeGalleryModal();
            document.body.classList.remove('is-store-menu-open');
            const p = String(i.content || i.prompt || i.title || '').replace(/2x2\s*grid/gi, '').replace(/\s+/g, ' ').trim();
            if (typeof window.startCharacterImageChat === 'function') {
                await window.startCharacterImageChat(i.id, i.image_url, p, (i.persona_name || i.nickname || i.safeIp || 'Character').slice(0,80), (i.persona_personality || '').slice(0,300));
            }
        },

        getSortedNewsCategories(){ return this.newsCategories.slice(); },
        getSortedGalleryCategories(){ return this.galleryCategories.slice(); },
        getSortedForumCategories(){ return this.forumCategories.slice(); },
        getSortedStoreCategories(){ return this.storeCategories.slice(); },
        getSortedCodeCategories(){ return this.codeCategories.slice(); },

        refreshInterestLayout(t){ this.applyInterestSort(t); this.$nextTick(() => { this.updateMacy(t); setTimeout(() => { this.updateMacy(t); }, 150); }); },
        async warmupAiPool(t){ if(t!=='gallery'||this.warmupDone[t])return; this.warmupDone[t]=true; for(let i=0;i<2&&!this.end[t];i++)await this.loadData(t); this.refreshInterestLayout(t); this.initialInterestSortDone[t]=true; },

        // =========================================================================
        // [초기화 및 무한 스크롤 옵저버 셋업]
        // =========================================================================
        async init() {
            window.$boardApp=this; 
            this.normalizeCategoryStrings();
            
            this.interestProfile = JSON.parse(localStorage.getItem('isai_interest_profile_v1')||'{}');
            this.productProfile = JSON.parse(localStorage.getItem('isai_product_profile_v1')||'{}');
            this.marketProfile = JSON.parse(localStorage.getItem('isai_market_profile_v1')||'{}');
            this.itemProfile = JSON.parse(localStorage.getItem('isai_item_profile_v1')||'{}');
            
            if(!this.hasInitialNewsSearch) {
                if (this.newsCategories && this.newsCategories.length > 0) {
                    this.selectedNewsCategoryQ = this.newsQuery = this.newsCategories[0].q;
                }
            } else {
                this.selectedNewsCategoryQ = this.newsQuery = window.__RE_BOARD3_CONFIG__.initialNewsQuery || '';
            }

            this.syncMarketWidgetMode(true);
            
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if(['news','forum','store','gallery','code'].includes(tabParam)) this.curTab = tabParam;
            const vParam = urlParams.get('v');
            if (vParam) {
                this.curTab = 'gallery';
                fetch(`re_store.php?action=get_post&id=${vParam}`).then(r => r.json()).then(j => {
                    const item = j.data || j; if(item && (item.id || item.share_id)) this.openGalleryItem(item);
                }).catch(e=>{});
            }

            await this.loadData(this.curTab); 
            await this.loadSearchProducts(); 
            await this.warmupAiPool(this.curTab); 
            this.refreshInterestLayout(this.curTab);

            // [무한 스크롤 완벽 지원] 감지 범위(rootMargin)를 600px로 대폭 늘려서 끊김없이 로드되도록 처리
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(x => {
                    if (x.isIntersecting) {
                        const tab = x.target.dataset.tab;
                        if (tab === this.curTab && !this.loading[tab] && !this.end[tab]) {
                            this.loadData(tab);
                        }
                    }
                });
            }, { rootMargin: '600px', threshold: 0.01 });

            this.$nextTick(() => {
                document.querySelectorAll('.loading-sentinel').forEach(el => {
                    el.style.display = 'block';
                    el.style.minHeight = '1px'; // 강제 영역 확보로 관찰 보장
                    obs.observe(el);
                });
            });
        },

        async switchTab(t){ 
            this.curTab=t; 
            if(t==='news'){this.syncMarketWidgetMode(false);} 
            this.loadSearchProducts(); 
            window.dispatchEvent(new CustomEvent('board-tab-change',{detail:{tab:t}})); 
            if(!this.items[t].length){ await this.loadData(t); await this.warmupAiPool(t); if(t!=='gallery')this.initialInterestSortDone[t]=true; } 
            this.refreshInterestLayout(t); 
        },

        getTopInterestKeywords(limit=5){
            return Object.entries(this.interestProfile || {})
                .filter(([key, value]) => key.startsWith('kw_') && Number(value) > 0)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, limit)
                .map(([key]) => key.replace(/^kw_/, ''))
                .filter(Boolean);
        },

        getSponsorSearchQuery(base=''){
            const terms = [];
            String(base || '').split(/\s+/).forEach(v => {
                const t = v.trim();
                if (t && t.toLowerCase() !== 'all') terms.push(t);
            });
            this.getTopInterestKeywords(5).forEach(t => {
                if (!terms.some(x => x.toLowerCase() === t.toLowerCase())) terms.push(t);
            });
            return terms.slice(0, 8).join(' ');
        },

        async loadSearchProducts(){
            let q = '';
            const isSearchMode = this.isProductSearchMode();
            if (isSearchMode && this.curTab === 'news') q = this.newsQuery;
            else if (isSearchMode && this.curTab === 'store') q = this.storeQuery;
            else if (isSearchMode && this.curTab === 'forum') q = this.forumQuery;
            else if (isSearchMode && this.curTab === 'code') q = this.codeQuery;
            else if (isSearchMode && this.curTab === 'gallery') q = this.galleryQuery;
            
            q = String(q || (isSearchMode ? this.searchQuery : '') || '').trim();
            if(q === 'all') q = '';

            try{
                const productLimit = isSearchMode ? 24 : 3;
                const lang = String(window.ISAI_SERVER_I18N?.locale || window.__RE_BOARD3_CONFIG__?.marketHeatmapLocale || 'all').trim();
                const r = await fetch(`/re_products.php?action=list_products&q=${encodeURIComponent(q)}&limit=${productLimit}&lang=${encodeURIComponent(lang)}`);
                const j = await r.json();
                this.items.products = Array.isArray(j?.data) ? j.data :[];
                this.applyInterestSort('products');
                this.$nextTick(()=>this.updateMacy(this.curTab));
            }catch(e){ this.items.products=[]; }
        },

        async loadData(t) {
            if (this.loading[t]||this.end[t]) return; 
            this.loading[t] = true;
            try {
                let u='';
                if(t==='news') { const nl = window.__RE_BOARD3_CONFIG__?.newsLang || {}; u=`/re_board3.php?action=get_news&q=${encodeURIComponent(this.newsQuery)}&hl=${encodeURIComponent(nl.hl||'ko')}&gl=${encodeURIComponent(nl.gl||'KR')}&ceid=${encodeURIComponent(nl.ceid||'KR:ko')}`; }
                else if(t==='gallery') u=`re_store.php?action=list_posts&type=gallery&page=${this.page[t]}&q=${encodeURIComponent(this.galleryQuery||'')}`;
                else if(t==='store') u=`re_store.php?action=list_apps&page=${this.page[t]}&q=${encodeURIComponent(this.storeQuery||this.searchQuery||'')}`;
                else if(t==='forum') u=`re_store.php?action=list_posts&type=forum&page=${this.page[t]}${this.currentTag?'&tag='+encodeURIComponent(this.currentTag):''}&q=${encodeURIComponent(this.forumQuery||'')}`;
                else if(t==='code') u=`re_store.php?action=list_code_publish&page=${this.page[t]}&limit=24&q=${encodeURIComponent(this.codeQuery||'')}`;

                const res = await fetch(u);
                const d = (await res.json()).data||[];
                if(!d.length) {
                    this.end[t]=true;
                } else {
                    const pd = d.map(i=>{
                        i.title=this.decodeEscapedText(i.title); i.content=this.decodeEscapedText(i.content); i.snippet=this.decodeEscapedText(i.snippet);
                        if(i.image_url)i.image_url=i.image_url.replace(/(imgur\.com\/[a-zA-Z0-9]+)\.(jpg|png|webp)/i, (m,p1,p2)=>p1+'l.'+p2);
                        i.avatar=`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(i.nickname||i.source||i.title||'U')}&backgroundColor=transparent`;
                        if(t==='forum'){ i.listText=String(i.content||i.title||'').replace(/<[^>]*>?/gm,' ').trim().slice(0, 100); }
                        else if(t==='news'){ i.cleanTitle=(i.title?.split(' - ')[0])||i.title; }
                        return i;
                    });
                    
                    const existingKeys = new Set(this.items[t].map(x => x.id || x.link));
                    const newItems = pd.filter(x => !existingKeys.has(x.id || x.link));

                    // Alpine.js 배열 반응성을 100% 보장하기 위해 push 대신 재할당
                    if(newItems.length > 0) {
                        const wasEmpty = this.items[t].length === 0;
                        const currentPage = this.page[t];
                        this.items[t] = [...this.items[t], ...newItems];
                        if(t==='news') this.end[t]=true; else this.page[t]++;
                        if (wasEmpty || currentPage <= 1) {
                            this.refreshInterestLayout(t);
                        } else {
                            this.$nextTick(() => { this.updateMacy(t); setTimeout(() => { this.updateMacy(t); }, 150); });
                        }
                    } else {
                        this.end[t] = true;
                    }
                }
            } catch(e){} finally { this.loading[t]=false; }
        },

        updateMacy(t) { 
            this.$nextTick(() => { 
                if (!macyInstances[t]) {
                    macyInstances[t] = Macy({
                        container: `#${t}-feed`,
                        trueOrder: true, waitForImages: true, margin: 16, columns: 6,
                        breakAt: { 1600: 6, 1200: 4, 900: 3, 640: 2 }
                    });
                    macyInstances[t].runOnImageLoad(() => macyInstances[t].recalculate(true, true), true);
                } else {
                    macyInstances[t].recalculate(true, true);
                }
            }); 
        },
        parseTags(t){ return String(t||'').replace(/<[^>]*>?/gm,'').replace(/(^|\s)#([a-zA-Z0-9가-힣_]+)/g,(m,p,tag)=>`${p}<span class="inline-block bg-gray-100 dark:bg-gray-800 text-[10px] px-2 py-0.5 rounded-full cursor-pointer font-bold" onclick="event.stopPropagation(); window.location.href='/?tag=${encodeURIComponent(tag)}'">#${tag}</span>`); }
    }));
});
