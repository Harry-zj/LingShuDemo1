<template>
  <div class="dim-page">
    <div class="bg-deco">
      <div class="deco-orb orb-1" :style="{background:dim.color}"></div>
      <div class="deco-orb orb-2" :style="{background:dim.color}"></div>
    </div>

    <div class="dim-topbar">
      <router-link to="/module2/report" class="back-link"><VIcon icon="mdi:arrow-left" /></router-link>
      <h2 class="dim-title"><span class="dim-dot" :style="{background:dim.color}"></span>{{ dim.name }}维度活动指南</h2>
      <div class="topbar-spacer"></div>
    </div>

    <div class="de-layout">
      <div class="de-hero">
        <div class="de-img-frame">
          <div class="de-img-placeholder" :style="{background: 'linear-gradient(135deg,' + dim.color + '06, var(--color-surface-variant))'}">
            <div class="de-ph-ring" :style="{borderColor:dim.color}"></div>
            <VIcon icon="mdi:image-outline" class="de-ph-icon" :style="{color:dim.color}" />
            <span>活动海报 / 现场照片轮播区</span>
            <span class="de-ph-sub">暂未上传素材</span>
          </div>
          <div class="de-img-dots"><span class="dot active" :style="{background:dim.color}"></span><span class="dot"></span><span class="dot"></span></div>
        </div>
        <p class="de-hero-desc">{{ dim.desc }}</p>
        <div class="de-hero-count">共 {{ displayActs.length }} 项推荐活动 · 点击卡片查看详情</div>
      </div>

      <div class="de-acts">
        <div class="de-act-card" v-for="(act, i) in displayActs" :key="i"
          :style="{ animationDelay: (0.08 * i) + 's' }"
          @click="openDetail(act)">
          <div class="de-act-bar" :style="{background: 'linear-gradient(90deg,' + dim.color + ',' + dim.color + '44)'}"></div>
          <div class="de-act-content">
            <div class="de-act-head">
              <div class="de-act-left">
                <span class="de-act-num" :style="{color:dim.color, borderColor:dim.color}">{{ i + 1 }}</span>
                <div>
                  <div class="de-act-title">{{ act.title }}<span class="de-act-cat" v-if="act.cat" :style="{color:dim.color, background:dim.color+'10'}">{{ act.cat }}</span></div>
                </div>
              </div>
              <span class="de-act-btn" @click.stop="addToGoals(act)"><VIcon icon="mdi:plus" /> 添加至目标</span>
            </div>
            <div class="de-act-desc">{{ act.desc }}</div>
            <a v-if="act.url" :href="act.url" target="_blank" class="de-act-url" @click.stop>
              <VIcon icon="mdi:open-in-new" size="14" /> {{ act.url }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <teleport to="body">
      <div class="modal-overlay" v-if="detailAct" @click.self="detailAct = null">
        <div class="modal-card" @click.stop>
          <div class="modal-accent" :style="{background:dim.color}"></div>
          <div class="modal-header">
            <h3>{{ detailAct.title }}</h3>
            <button class="modal-close" @click="detailAct = null"><VIcon icon="mdi:close" /></button>
          </div>
          <span class="modal-cat" v-if="detailAct.cat" :style="{color:dim.color, background:dim.color+'10'}">{{ detailAct.cat }}</span>
          <p class="modal-desc">{{ detailAct.fullDesc || detailAct.desc }}</p>
          <div class="modal-info" v-if="detailAct.url">
            <VIcon icon="mdi:web" /> 官方网址：
            <a :href="detailAct.url" target="_blank" class="modal-link">{{ detailAct.url }}</a>
          </div>
          <div class="modal-info" v-if="detailAct.score">
            <VIcon icon="mdi:star-outline" /> 预计加分：<strong>{{ detailAct.score }}</strong>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue"
import { useRoute } from "vue-router"
import { useUserStore } from "../../stores/user"
import { DIMENSION_CONFIG } from "../../utils/scoreHelper"

const route = useRoute()
const userStore = useUserStore()
const dimKey = computed(() => route.params.key || 'de')
const dim = computed(() => DIMENSION_CONFIG.find(d => d.key === dimKey.value) || DIMENSION_CONFIG[0])
const displayActs = ref([])
const detailAct = ref(null)
const addedSet = ref(new Set())

function openDetail(act) { detailAct.value = act }

function seededRandom(seed) {
  let h = 0; for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }
  return () => { h = (h * 1103515245 + 12345) | 0; return (h >>> 0) / 0xFFFFFFFF }
}
function pickSeeded(arr, count, seed) {
  const rng = seededRandom(seed)
  return [...arr].sort(() => rng() - 0.5).slice(0, count)
}

function addToGoals(act) {
  if (addedSet.value.has(act.title)) { alert('该活动已在成长目标中'); return }
  const goals = JSON.parse(localStorage.getItem('lingshu_goals_v2') || '[]')
  const text = `参与"${act.title}"`
  const existing = goals.find(g => g.key === dimKey.value)
  if (existing) { if (!existing.text.includes(text)) existing.text = existing.text ? existing.text + '；' + text : text }
  else { goals.push({ key: dimKey.value, text }) }
  localStorage.setItem('lingshu_goals_v2', JSON.stringify(goals))
  addedSet.value.add(act.title)
  alert('已添加至成长目标')
}

// ===== 活动池 =====
const allPools = {
  de: [
    { title:'主题团课理论学习', cat:'A1 思想政治', desc:'常态化参与班级、学院组织的思政专题学习与青年大学习，积累思想表现佐证材料。' },
    { title:'红色教育基地研学', cat:'A1 思想政治', desc:'参观党史馆、烈士陵园等红色阵地，撰写学习感悟，提升政治素养。' },
    { title:'入党积极分子党校培训', cat:'A1 思想政治', desc:'完成学校党课系列学习与结业考核，系统提升政治理论水平。' },
    { title:'爱国主题征文与宣讲', cat:'A1 思想政治', desc:'围绕党史、新时代青年、爱国主义主题开展分享与征文，弘扬正向思想。' },
    { title:'校园公共劳动值守', cat:'A2 道德品质', desc:'负责教学楼、走廊、校园绿化带日常保洁养护，践行劳动精神。' },
    { title:'文明宿舍创建评比', cat:'A2 道德品质', desc:'整理宿舍内务、参与宿舍美化，获评文明宿舍称号，体现日常品德习惯。' },
    { title:'校园美育文艺展演', cat:'A2 道德品质', desc:'参与书画展、国风文艺汇演、红色舞台剧等校内美育活动。' },
    { title:'诚信主题教育班会', cat:'A2 道德品质', desc:'参加诚信宣誓、考风考纪主题学习，恪守诚实守信准则。' },
    { title:'班级同学互助帮扶', cat:'A2 道德品质', desc:'日常主动帮扶生活、学习有困难的同学，践行友善公德。' },
    { title:'经典读物读书分享会', cat:'A3 学习作风', desc:'参与校内红色书目、思想类书籍沙龙，坚持课外自主理论阅读。' },
    { title:'课堂纪律示范学习', cat:'A3 学习作风', desc:'全学期无迟到、旷课、早退，自觉遵守课堂规章制度。' },
    { title:'班级学风建设宣传员', cat:'A3 学习作风', desc:'协助班委开展班风整顿、学习纪律提醒，带动良好班级风气。' },
    { title:'班级集体主题团建', cat:'A4 组织纪律', desc:'参与班级团日、集体班会、集体文体活动，维护集体荣誉。' },
    { title:'宿舍文化建设活动', cat:'A4 组织纪律', desc:'参加宿舍文化节、宿舍安全主题活动，自觉遵守管理条例。' },
    { title:'班委/宿舍长学生任职', cat:'A4 组织纪律', desc:'担任团干部、班委、宿舍长，配合完成班级和宿舍日常管理。' },
    { title:'校规校纪安全教育课堂', cat:'A4 组织纪律', desc:'参与宿舍安全、校园纪律专题学习，树立规矩意识。' },
  ],
  zhi: [
    // B1 考证（全专业通用，不设 majors 限制）
    { title:'大学英语四级/六级（CET-4/6）', cat:'B1 证书', desc:'全国大学英语四六级考试，最基础的英语能力证明。', url:'https://cet.neea.edu.cn/', score:'B1 +2~6' },
    { title:'全国计算机等级考试（NCRE）', cat:'B1 证书', desc:'一/二/三级计算机证书，涵盖Office、编程、数据库等方向。', url:'https://ncre.neea.edu.cn/', score:'B1 +2~6' },
    { title:'普通话水平测试等级证书', cat:'B1 证书', desc:'考取二乙及以上普通话证书，教师、播音等职业必备。', url:'https://www.cltt.org/', score:'B1 +1~3' },
    { title:'教师资格证（中小学）', cat:'B1 证书', desc:'中小学教师资格考试，教育行业准入门槛。', url:'https://ntce.neea.edu.cn/', score:'B1 +3~6' },
    { title:'初级/中级会计职称', cat:'B1 证书', desc:'会计专业技术资格考试，财会专业核心证书。', url:'http://kzp.mof.gov.cn/', score:'B1 +2~6', majors:['会计','财务','审计','经济','金融'] },
    { title:'证券/基金/期货从业资格证', cat:'B1 证书', desc:'金融行业准入证书，证券/基金/期货从业。', url:'https://www.sac.net.cn/', score:'B1 +2~6', majors:['金融','经济','会计','财务'] },
    { title:'SYB创业培训证书', cat:'B1 证书', desc:'参与创业实训课程，取得人社部SYB创业培训结业证书。', score:'B1 +2~4' },
    { title:'驾驶证（C1/C2）', cat:'B1 证书', desc:'机动车驾驶证，大学期间考取可加综测分。', score:'B1 +1~3' },
    { title:'CAD/BIM工程师证书', cat:'B1 证书', desc:'建筑、机械、土木专业核心技能证书。', score:'B1 +2~6', majors:['建筑','土木','机械','工程','设计'] },
    // B2 竞赛
    { title:'中国国际大学生创新大赛（互联网+）', cat:'B2 竞赛', desc:'教育部主办最高级别创新创业赛事，校→省→国三级。', url:'https://cy.ncss.cn/', score:'B2 +5~20', majors:['计算机','软件','电子','信息'] },
    { title:'"挑战杯"课外学术科技作品竞赛', cat:'B2 竞赛', desc:'共青团中央主办科创赛事，分自然科学、社科、发明三类。', url:'http://www.tiaozhanbei.net/', score:'B2 +5~20', majors:['计算机','电子','机械','自动化','物理'] },
    { title:'"挑战杯"创业计划竞赛', cat:'B2 竞赛', desc:'侧重商业策划与创业实践，偶数年举办。', url:'http://www.tiaozhanbei.net/', score:'B2 +5~15', majors:['经济','管理','金融','市场'] },
    { title:'全国大学生数学建模竞赛', cat:'B2 竞赛', desc:'3人组队72小时建模解题，理工科经典赛事。', url:'http://www.mcm.edu.cn/', score:'B2 +5~15', majors:['数学','计算机','统计','物理','工程','电子'] },
    { title:'美国大学生数学建模竞赛（MCM）', cat:'B2 竞赛', desc:'国际数学建模赛事，中英文论文参赛。', url:'https://www.comap.com/', score:'B2 +5~20', majors:['数学','计算机','统计','工程'] },
    { title:'蓝桥杯全国软件和信息技术大赛', cat:'B2 竞赛', desc:'算法/软件开发/嵌入式竞赛，省赛→国赛。', url:'https://dasai.lanqiao.cn/', score:'B2 +3~10', majors:['计算机','软件','信息','电子','通信'] },
    { title:'ACM-ICPC国际大学生程序设计竞赛', cat:'B2 竞赛', desc:'全球顶级编程竞赛，3人组队算法对抗。', url:'https://icpc.global/', score:'B2 +5~20', majors:['计算机','软件','人工智能','数据'] },
    { title:'全国大学生电子设计竞赛', cat:'B2 竞赛', desc:'硬件电路、嵌入式系统实物制作，奇数年国赛。', url:'http://www.nuedcchina.com/', score:'B2 +5~15', majors:['电子','通信','电气','自动化','信息'] },
    { title:'全国大学生机械创新设计大赛', cat:'B2 竞赛', desc:'机械结构、智能装置实物创新，两年一届。', url:'http://umic.ckcest.cn/', score:'B2 +5~15', majors:['机械','自动化','机电','车辆'] },
    { title:'全国大学生智能汽车竞赛', cat:'B2 竞赛', desc:'自动驾驶小车硬件编程调试竞赛。', url:'http://smartcar.caeit.com/', score:'B2 +3~10', majors:['自动化','电子','计算机','车辆','机械'] },
    { title:'全国大学生信息安全竞赛', cat:'B2 竞赛', desc:'网络攻防、系统安全开发比拼。', url:'http://www.ciscn.cn/', score:'B2 +3~10', majors:['计算机','信息安全','网络','软件'] },
    { title:'"中国软件杯"大学生软件设计大赛', cat:'B2 竞赛', desc:'应用软件/小程序/系统开发赛事。', url:'http://www.cnsoftbei.com/', score:'B2 +3~10', majors:['计算机','软件','信息'] },
    { title:'全国大学生统计建模大赛', cat:'B2 竞赛', desc:'数据分析、统计建模课题竞赛。', url:'http://tjjmds.ai-learning.net/', score:'B2 +3~8', majors:['统计','数学','数据','经济','计算机'] },
    { title:'全国大学生结构设计竞赛', cat:'B2 竞赛', desc:'建筑结构模型承重创新比拼。', url:'http://www.structurecontest.com/', score:'B2 +3~10', majors:['土木','建筑','工程','力学'] },
    { title:'全国大学生电子商务三创挑战赛', cat:'B2 竞赛', desc:'电商创新/三农电商/跨境电商项目竞赛。', url:'https://www.3chuang.net/', score:'B2 +3~10', majors:['电子商务','市场','管理','经济'] },
    { title:'"外研社·国才杯"外语能力大赛', cat:'B2 竞赛', desc:'英语演讲/写作/阅读综合赛事，外语类最高级别。', url:'https://uchallenge.unipus.cn/', score:'B2 +3~10', majors:['英语','外语','翻译'] },
    // B3 科研
    { title:'大学生创新创业训练计划（大创）', cat:'B3 科研', desc:'组队申报校级/省级/国家级科研课题，导师指导。', score:'B3 +3~10' },
  ],
  ti: [
    // A5 身心健康
    { title:'阳光长跑学期打卡', cat:'A5 日常锻炼', desc:'每学期完成60km长跑打卡，日常自主慢跑锻炼，截图即可作为佐证。' },
    { title:'班级趣味体育活动', cat:'A5 日常锻炼', desc:'参与班级羽毛球、乒乓球、拔河、趣味接力等简易集体体育活动。' },
    { title:'校院日常体操体能训练', cat:'A5 日常锻炼', desc:'运动会团体操日常体能排练，仅健身锻炼方向，不含文艺舞台展演。' },
    { title:'年度体质健康测试', cat:'A5 日常锻炼', desc:'按时完成学校统一体测各项项目，无缺考，体测表作为佐证材料。' },
    { title:'球类社团基础训练', cat:'A5 日常锻炼', desc:'加入校田径、羽毛球、乒乓球社团，参与课后基础体能训练。' },
    { title:'心理健康主题班会学习', cat:'A5 心理健康', desc:'参与情绪管理、挫折教育、人际相处心理专题课堂，各班统一开展。' },
    { title:'心理团体成长辅导小组', cat:'A5 心理健康', desc:'班级组织心理团辅，疏导压力、调节心态，活动签到表即为佐证。' },
    // B7 纯体育赛事
    { title:'全国大学生运动会', cat:'B7 体育赛事', desc:'国家级田径、球类等体育竞技项目参赛，最高级别大学生体育赛事。', url:'https://www.sportedu.org.cn/', score:'B7 +5~20' },
    { title:'湖南省大学生运动会', cat:'B7 体育赛事', desc:'省级高校各类体育项目比拼，省内最高水平大学生体育竞技。', url:'http://www.hunanjiaoyu.com/', score:'B7 +3~10' },
    { title:'校春季/秋季田径运动会', cat:'B7 体育赛事', desc:'校内短跑、长跑、跳远、接力等基础田径项目，报名即可参与。', score:'B7 +2~8' },
    { title:'校园篮球/足球/排球联赛', cat:'B7 体育赛事', desc:'院级、校级常规球类集体赛事，各学院均会组织选拔参赛。', score:'B7 +2~8' },
    { title:'校园乒乓球/羽毛球单项赛', cat:'B7 体育赛事', desc:'小球类简易对抗赛事，报名门槛低，适合大多数学生参与。', score:'B7 +1~5' },
    { title:'校园趣味体能挑战赛', cat:'B7 体育赛事', desc:'拔河、接力、障碍跑等大众集体体育竞赛，班级为单位参与。', score:'B7 +1~3' },
    { title:'高校太极拳/武术体育锦标赛', cat:'B7 体育赛事', desc:'传统武术体能竞技，侧重健身方向而非文艺演出。', score:'B7 +2~8' },
    { title:'高校定向越野挑战赛', cat:'B7 体育赛事', desc:'户外徒步体能类体育活动，考验体能和团队协作能力。', score:'B7 +2~6' },
  ],
  mei: [
    // 文学创作
    { title:'校园主题征文投稿', cat:'B4 文学创作', desc:'参与学院、学校举办的青春、红色、美育主题征文，撰写原创散文、记叙文。' },
    { title:'青评网评论稿件撰写', cat:'B4 文学创作', desc:'撰写校园热点、青年思想类短评，完成基础稿量外可累计加分。' },
    { title:'读书分享赏析文稿撰写', cat:'B4 文学创作', desc:'阅读文学、美育类书籍，撰写赏析文稿并参与班级分享活动。' },
    { title:'演讲/朗诵原创文稿撰写', cat:'B4 文学创作', desc:'为校园朗诵、主题演讲活动自主撰写文字稿件。' },
    // 视觉美术
    { title:'校园活动海报制作', cat:'B4 视觉美术', desc:'协助学生会、学院制作活动宣传海报，手绘或电子均可。' },
    { title:'书法/国画/素描作品参展', cat:'B4 视觉美术', desc:'创作简易书画作品，参与校级、学院美育书画展览评比。' },
    { title:'校园纪实摄影拍摄投稿', cat:'B4 视觉美术', desc:'拍摄校园活动、校园风光照片，投递学院新媒体平台。' },
    { title:'简易手工美育作品创作', cat:'B4 视觉美术', desc:'剪纸、手绘贺卡、简易手作参与宿舍文化节或美育展示。' },
    // 新媒体影音
    { title:'院级/校级公众号图文推送编辑', cat:'B4 新媒体', desc:'撰写活动文案、排版公众号推送，新媒体部成员超额完成可加分。' },
    { title:'校园活动纪实短视频拍摄', cat:'B4 新媒体', desc:'记录班会、美育活动现场，简单剪辑短视频上交校影音部门。' },
    { title:'校园新闻稿件撰写投稿', cat:'B4 新媒体', desc:'撰写班级、学院活动新闻，发布在校院官方网站或新媒体平台。' },
    { title:'校园广播栏目供稿', cat:'B4 新媒体', desc:'撰写美文、校园趣事广播稿件，投递校园广播台。' },
    // 媒体发表
    { title:'校内官方平台文艺作品刊发', cat:'B4 媒体发表', desc:'文学、摄影、短评作品在校官网、星网、青评网等平台发布。', score:'B4 +2~5' },
    { title:'省级/国家级教育媒体文艺投稿', cat:'B4 媒体发表', desc:'向中国大学生在线等官方平台投递美育、校园主题文稿。', score:'B4 +3~8' },
    // 文艺赛事
    { title:'全国大学生艺术展演', cat:'B4 文艺赛事', desc:'参与书画、散文、朗诵类文艺比拼，无复杂文创设计要求。', url:'https://www.moe.gov.cn/s78/A17/', score:'B4 +3~10' },
    { title:'全国大学生广告艺术大赛（大广赛）', cat:'B4 文艺赛事', desc:'以海报、短视频创意为主，基础设计工具即可完成参赛作品。', url:'https://www.sun-ada.net/', score:'B4 +2~8' },
    { title:'中国好创意数字艺术设计大赛', cat:'B4 文艺赛事', desc:'插画、短片、简易数字绘画创作赛道，适合普通学生参与。', url:'https://www.cdec.org.cn/', score:'B4 +2~8' },
    { title:'全国大学生网络文化节', cat:'B4 文艺赛事', desc:'日常拍摄的照片、自制短文、短视频均可参赛，门槛低。', url:'https://www.gxhl.com/', score:'B4 +2~8' },
    { title:'"普译奖"文学翻译竞赛', cat:'B4 文艺赛事', desc:'文学短文翻译，文字美育类竞赛，适合有外语基础的学生。', url:'https://www.puyiprize.com/', score:'B4 +1~4' },
  ],
  lao: [
    { title:'暑期社会实践项目', cat:'B6 社会实践', desc:'参加三下乡或组队开展社会调研、企业实习、公益服务。' },
    { title:'校园公益与劳动实践', cat:'B8 劳动教育', desc:'参与环境维护、图书馆整理、文明寝室创建等活动。' },
    { title:'学生工作与社会任职', cat:'B5 社会工作', desc:'担任班委、社团干部或勤工助学岗位，积累管理经验。' },
    { title:'社区志愿服务与义工', cat:'B6/B8 实践劳动', desc:'参加社区义工、支教、赛事志愿者等校外服务活动。' },
    { title:'实践报告与成果整理', cat:'综合', desc:'每次活动后及时撰写图文并茂的实践报告，作为加分认定依据。' },
  ],
}

const PICK_COUNT = { de:5, zhi:8, ti:7, mei:7, lao:5 }

onMounted(() => {
  const pool = allPools[dimKey.value] || allPools.de
  const count = PICK_COUNT[dimKey.value] || 5
  const uid = userStore.user?.id || userStore.user?.username || 'default'
  const seed = `dim_v6_${dimKey.value}_${uid}`
  const cacheKey = `lingshu_dim_acts_v6_${dimKey.value}_${uid}`

  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { const parsed = JSON.parse(cached); if (parsed.length > 0) { displayActs.value = parsed; return } } catch {}
  }

  // 根据专业优先推荐相关活动
  let sorted = [...pool]
  const major = (userStore.user?.major || '').toLowerCase()
  if (major && dimKey.value === 'zhi') {
    sorted.sort((a, b) => {
      const aMatch = a.majors?.some(m => major.includes(m)) ? 1 : 0
      const bMatch = b.majors?.some(m => major.includes(m)) ? 1 : 0
      return bMatch - aMatch  // 匹配的排前面
    })
  }
  const picked = pickSeeded(sorted.slice(0, 12), Math.min(count, pool.length), seed)
  displayActs.value = picked
  localStorage.setItem(cacheKey, JSON.stringify(picked))
})
</script>

<style scoped>
.dim-page { animation:fadeIn 0.4s ease; max-width:1280px; margin:0 auto; padding:0 16px 40px; position:relative; }
.bg-deco { position:fixed; top:0;left:0;right:0;bottom:0; pointer-events:none; z-index:0; overflow:hidden; }
.deco-orb { position:absolute; border-radius:50%; opacity:0.04; filter:blur(100px); }
.orb-1 { width:360px;height:360px; top:10%; right:-120px; }
.orb-2 { width:240px;height:240px; bottom:20%; left:-80px; }

.dim-topbar { display:flex; align-items:center; gap:16px; padding:12px 0 20px; position:relative; z-index:1; }
.back-link { display:flex; align-items:center; justify-content:center; width:38px;height:38px; border-radius:50%; border:1px solid var(--color-border); color:var(--color-text-secondary); text-decoration:none; transition:all 0.2s; }
.back-link:hover { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }
.dim-title { font-size:24px; font-weight:700; color:var(--color-text); flex:1; text-align:center; margin:0; display:flex; align-items:center; justify-content:center; gap:10px; }
.dim-dot { width:12px;height:12px; border-radius:50%; flex-shrink:0; }
.topbar-spacer { width:38px; flex-shrink:0; }

.de-layout { display:flex; gap:20px; align-items:flex-start; position:relative; z-index:1; }
.de-hero { flex:0 0 50%; position:sticky; top:24px; }
.de-img-frame { background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:20px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.03); transition:box-shadow 0.3s; }
.de-img-frame:hover { box-shadow:0 6px 32px rgba(0,0,0,0.06); }
.de-img-placeholder { aspect-ratio:3/2; display:flex; flex-direction:column; align-items:center; justify-content:center; border-bottom:1px dashed var(--color-border); color:var(--color-text-tertiary); position:relative; }
.de-ph-ring { position:absolute; width:60%; aspect-ratio:1; border-radius:50%; border:1px dashed; opacity:0.12; }
.de-ph-icon { font-size:56px; opacity:0.22; margin-bottom:16px; position:relative; z-index:1; }
.de-img-placeholder span { font-size:14px; opacity:0.45; position:relative; z-index:1; }
.de-ph-sub { font-size:12px !important; opacity:0.28 !important; margin-top:6px; }
.de-img-dots { display:flex; gap:8px; justify-content:center; padding:16px; }
.de-img-dots .dot { width:8px;height:8px; border-radius:50%; background:var(--color-border); transition:all 0.2s; }
.de-hero-desc { margin-top:16px; font-size:15px; color:var(--color-text-secondary); line-height:1.8; text-align:center; }
.de-hero-count { text-align:center; margin-top:8px; font-size:13px; color:var(--color-text-tertiary); }

.de-acts { flex:1; display:flex; flex-direction:column; gap:16px; min-width:0; }
.de-act-card { position:relative; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:16px; overflow:hidden; box-shadow:0 1px 8px rgba(0,0,0,0.02); transition:all 0.25s ease; opacity:0; animation:cardIn 0.5s ease forwards; cursor:pointer; }
.de-act-card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.06); transform:translateY(-2px); }
@keyframes cardIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
.de-act-bar { height:3px; }
.de-act-content { padding:18px 22px; }
.de-act-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px; }
.de-act-left { display:flex; align-items:flex-start; gap:14px; flex:1; min-width:0; }
.de-act-num { width:28px;height:28px; border-radius:50%; border:2px solid; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; opacity:0.7; }
.de-act-title { font-size:17px; font-weight:700; color:var(--color-text); line-height:1.5; }
.de-act-cat { display:inline-block; margin-left:8px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:500; vertical-align:middle; }
.de-act-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 16px; border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:12px; color:var(--color-text-secondary); cursor:pointer; transition:all 0.15s; white-space:nowrap; flex-shrink:0; background:transparent; z-index:2; position:relative; }
.de-act-btn:hover { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }
.de-act-desc { font-size:15px; color:var(--color-text-secondary); line-height:1.7; padding-left:42px; }
.de-act-url { display:flex; align-items:center; gap:4px; margin-top:8px; padding-left:42px; font-size:12px; color:var(--color-primary); text-decoration:none; opacity:0.7; transition:opacity 0.15s; }
.de-act-url:hover { opacity:1; text-decoration:underline; }

/* 弹窗 */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.15); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease; }
.modal-card { background:#fff; border-radius:20px; padding:0; max-width:520px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:0 12px 48px rgba(0,0,0,0.1); position:relative; }
.modal-accent { height:4px; opacity:0.5; border-radius:4px 4px 0 0; }
.modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 8px; }
.modal-header h3 { font-size:18px; font-weight:700; margin:0; color:var(--color-text); }
.modal-close { width:32px;height:32px; border-radius:50%; border:1px solid var(--color-border); background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--color-text-secondary); }
.modal-close:hover { border-color:var(--color-primary); color:var(--color-primary); }
.modal-cat { display:inline-block; margin:0 24px 12px; padding:2px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.modal-desc { padding:0 24px; font-size:15px; color:var(--color-text-secondary); line-height:1.8; }
.modal-info { display:flex; align-items:center; gap:6px; padding:10px 24px; font-size:13px; color:var(--color-text-secondary); }
.modal-info strong { color:#059669; }
.modal-link { color:var(--color-primary); word-break:break-all; }

@media (max-width:768px) {
  .de-layout { flex-direction:column; }
  .de-hero { flex:auto; position:static; width:100%; }
  .de-img-placeholder { aspect-ratio:16/9; }
  .dim-page { max-width:100%; padding:0 12px 40px; }
  .de-act-desc { padding-left:0; }
}
</style>
