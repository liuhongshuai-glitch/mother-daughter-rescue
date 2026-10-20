/**
 * Gossip Harbor style dialogue: a mother / daughter portrait with one short line,
 * tap to advance, "skip" to drop the rest. The strip floats over the top of the
 * scene picture only, never over the board, and gameplay keeps running under it:
 * the timer is untouched, board input is never captured, and every line
 * auto-advances so an unattended bubble cannot park the player on an idle screen.
 *
 * Placement (v10): the strip is a compact avatar + bubble unit parked in a corner of the scene
 * picture that is clear of BOTH faces. The scene publishes head boxes
 * (window.__RESCUE_SCENE__.faces: now + a 3.3 s look-ahead span that follows the playing video
 * clip and the reveal camera); the strip tries the top corner opposite the speaker first, then
 * the other top corner, then the bottom corners, each in a normal / compact / tiny variant, and
 * takes the first that clears both spans. The bubble tail points at the speaker's face. A
 * per-frame check re-places the strip if a face ever reaches it.
 *
 * Beats: chapter opening (2-4 lines), each repair done (1 line), chapter done
 * (2 lines), fail (1 comforting line). Bilingual zh / en.
 */
const M = 'mother', D = 'daughter', F = 'father';

/** Chapter openings, one list per chapter (4 chapters x 5 repairs). */
const OPENING = [
  [
    [D, '妈妈，天窗破了，雪一直飘进来……', 'Mom, the skylight is broken. Snow keeps falling in…'],
    [M, '别怕，我们先把天窗补好。', "Don't worry. Let's fix the skylight first."],
    [M, '屋里有什么能用的，我们都找出来。', "Whatever we can find in here, we use."],
    [D, '然后就会暖和吗？', 'And then it gets warm?'],
  ],
  [
    [D, '妈妈，窗户只剩一个大洞了……', 'Mom, the window is just a big hole…'],
    [M, '先把洞封上，再把火塘生起来。', "Let's seal it, then get the hearth going."],
    [D, '我帮你递木板！', "I'll hand you the planks!"],
  ],
  [
    [D, '湖上的风从地板缝里钻上来。', 'The lake wind comes up through the floor.'],
    [M, '先挂上防水布，再补好那个洞。', "First the tarp, then we patch that hole."],
    [D, '我不怕，有你在。', "I'm not scared. You're here."],
  ],
  [
    [D, '门板倒了，雪都堆到屋里了。', 'The door fell in. Snow is piling up inside.'],
    [M, '修好门，再把灶台清出来。', "We fix the door, then clear the hearth."],
    [D, '这次会是我们真正的家吗？', 'Will this one be our real home?'],
    [M, '只要我们在一起，就是。', "As long as we're together, it is."],
  ],
];

/** Act II / III lines per home (acts start after 2 and 4 repairs); act I is the opening. */
const ACT = [
  [
    [[D, '雪不进来了！可铁炉还是冷的。', 'No more snow inside! But the stove is still cold.'], [D, '以前家里的炉子，从来不让我们碰。', 'At the old house, we were never allowed to touch the stove.'], [M, '这个炉子，我们自己来生火。', 'This stove, we light ourselves.']],
    [[M, '炉子热了，阁楼亮起来了。', 'The stove is warm. The attic is glowing.'], [D, '再铺好床，煮碗汤，就是家了！', 'A bed and some soup, and it is home!']],
  ],
  [
    [[M, '风小多了，换我们生火吧。', 'The wind has dropped. Time for a fire.'], [D, '我去捡干柴！', "I'll get the firewood!"]],
    [[D, '石墙也被烤暖了。', 'Even the stone walls feel warm.'], [M, '最后一点，我们就能歇下了。', 'One last bit, then we can rest.']],
  ],
  [
    [[D, '湖上的风小了。', 'The wind off the lake is calmer.'], [M, '地板不透风了，来烤烤火。', 'The floor is sealed. Come warm up.']],
    [[M, '太阳落山了，屋里却亮着。', 'The sun is setting, but it is bright in here.'], [D, '湖面也映着我们的火光！', 'The lake reflects our fire!'], [M, '以后我们不用再看谁的脸色了。', "From now on, we don't have to live by anyone's moods."]],
  ],
  [
    [[M, '门关得上了，灶台也通了。', 'The door shuts and the hearth is clear.'], [D, '太阳快出来了！', 'The sun is almost up!']],
    [[D, '第一缕阳光照进来了。', 'The first sunlight is coming in.'], [M, '我们的家，快修好了。', 'Our home is nearly done.']],
  ],
];

/** Each home's two signature repairs (tasks 0 and 1) get their own lines. */
const REPAIRED_HOME = [
  [[D, '天窗补好了！雪不会再落进来了。', "The skylight is fixed! No more snow inside."],
   [M, '烟囱通了，烟能顺着出去了。', 'The pipe is clear. The smoke can get out now.']],
  [[D, '窗洞封住了，风声小多了！', 'The window hole is sealed. So much quieter!'],
   [M, '吊锅挂好了，就等生火了。', 'The pot is hung. Now we just need a fire.']],
  [[D, '防水布挂好了，风吹不进来了！', 'The tarp is up. The wind cannot get in!'],
   [M, '地板补好了，脚底不冰了。', 'The floor is patched. No more icy feet.']],
  [[D, '门关上了！雪进不来了。', 'The door shuts! The snow stays out.'],
   [M, '灶台清干净了，可以生火了。', 'The hearth is clear. We can light it now.']],
];

/** One line after each repair (index = task 0..4); a second variant per chapter keeps replays fresh. */
const REPAIRED = [
  [[D, '风停了！我的手没那么冰了。', "The wind stopped! My hands aren't so cold."], [M, '窗封好了，屋里安静多了。', "Window's sealed. It's so much quieter."]],
  [[M, '屋顶不漏了，今晚不会淋湿。', "No more leaks. We'll stay dry tonight."], [D, '听，雪落在屋顶上沙沙响。', 'Listen, the snow is whispering on the roof.']],
  [[D, '火亮了！好暖好暖。', 'The fire is lit! So warm.'], [M, '来，把手伸过来烤一烤。', 'Come, hold your hands near the fire.']],
  [[D, '被子软软的，像云一样。', 'The quilt is soft, like a cloud.'], [M, '今晚可以好好睡一觉了。', 'We can finally sleep well tonight.']],
  [[M, '汤好了，小心烫。', 'Soup is ready. Careful, it is hot.'], [D, '好香！我们一起喝吧。', 'Smells so good! Let us share it.']],
];

const CHAPTER_DONE = [
  [[D, '妈妈，这里好暖和。', "Mom, it's so warm here."], [M, '是你陪我一起修好的。', 'You helped me fix every bit of it.']],
  [[M, '旧屋也能变得这么亮。', 'Even an old house can glow like this.'], [D, '因为我们一起努力了！', 'Because we worked together!']],
  [[D, '山里的夜不那么可怕了。', "The mountain night isn't scary anymore."], [M, '有火，有汤，还有你。', 'We have a fire, soup, and each other.']],
  [[M, '天亮了，我们到家了。', "It's morning. We're home."], [D, '谢谢你一直陪着我们。', 'Thank you for staying with us.']],
];

const COMFORT = [
  [M, '没关系，我们歇口气再来。', "It's okay. Let's catch our breath and try again."],
  [D, '妈妈说，慢慢来也可以。', 'Mom says slow is okay too.'],
  [M, '已经修好的不会丢，别着急。', "What we fixed stays fixed. No rush."],
];

/** Story that links the levels: the house keeps every finished repair, so each bridge picks up exactly
 *  where the last level ended and points at the next repair. {title, text, lines} with [zh, en] pairs. */
const PROLOGUE = {
  title: ['暴雪封山', 'Snowed in'],
  text: ['被赶出家门的那个雪夜，妈妈带着小暖翻山，要去外婆留下的空老屋。暴雪封住了山路，今晚只能先躲进一间天窗破了的阁楼。',
    'On the snowy night they were sent away from home, Mom and Nuan set off over the mountain for the empty old house Grandma left behind. The blizzard closes the road, so tonight they shelter in an attic with a broken skylight.'],
};
/** The prologue before chapter 1, five illustrated scenes. Dad appears only here; the ending never mentions him. */
const PROLOGUE_SCENES = [
  { img: 'prologue-1', title: ['曾经的家', 'The house we had'],
    text: ['深夜，爸爸坐在桌前，面前是空酒瓶和散落的纸牌。妈妈搂着小暖缩在角落，屋里的炉子已经很久没生火了。',
      'Late at night Dad sits at the table among empty bottles and scattered cards. Mom holds Nuan in the corner; the stove has not been lit for a long time.'],
    lines: [[D, '妈妈，我冷。', "Mom, I'm cold."], [M, '嘘……别吵到爸爸。', "Shh\u2026 don't wake Dad."]] },
  { img: 'prologue-2', title: ['\u201c出去\u201d', '\u201cGet out\u201d'],
    text: ['爸爸又输了钱，回家把火气全撒在母女俩身上。他打开门，冷风夹着雪灌了进来。',
      'Dad has lost money again and takes it out on them. He throws the door open, and the snowy wind rushes in.'],
    lines: [[F, '这房子是我的，你们俩出去！', 'This is my house. You two, out!'], [M, '外面在下雪，小暖只穿着睡衣……', 'It is snowing, and Nuan is only in pajamas\u2026'], [F, '那是你们的事。', "That's your problem."]] },
  { img: 'prologue-3', title: ['门关上了', 'The door shuts'],
    text: ['门\u201c砰\u201d地关上，窗帘也被拉上了。屋里的暖光还在，却已经不属于她们。小暖抱紧了布兔子。',
      'The door slams and the curtains are drawn. The warm light is still inside, but it is not theirs anymore. Nuan hugs her bunny tight.'],
    lines: [[D, '爸爸不要我们了吗？', "Doesn't Dad want us anymore?"], [M, '……妈妈在。我们去一个谁也赶不走我们的地方。', "\u2026Mom is here. We'll go somewhere no one can send us away."]] },
  { img: 'prologue-4', title: ['背包里的全部', 'All we carry'],
    text: ['她们身上只有：半盒火柴、三个土豆、一条红围巾、几枚硬币，还有外婆很久以前手画的山路图。图上最后一间屋子画着一颗心。',
      'All they have: half a box of matches, three potatoes, a red scarf, a few coins, and the mountain map Grandma drew long ago. The last house on it has a little heart.'],
    lines: [[M, '外婆的老屋一直空着，那里不用交房租。', "Grandma's old house has stood empty. No rent to pay there."], [D, '那我们自己修，修成我们的家！', "Then we'll fix it ourselves, into our home!"]] },
  { img: 'prologue-5', title: ['翻山', 'Over the mountain'],
    text: ['两人裹着同一条红围巾，在暴雪里往山上走。山坡上有一间天窗破了的空房子，今晚只能先躲进去。',
      'Wrapped in one red scarf, they climb into the blizzard. On the slope stands an empty house with a broken skylight. Tonight, it will have to do.'],
    lines: [[M, '屋里有什么能用的，我们都找出来。', "Whatever we can find in there, we use."]] },
];
const BRIDGE = [
  [ // attic: skylight, pipe, stove, bed, soup
    { title: ['雪停在窗外', 'Snow stays outside'], text: ['天窗补好了，雪花只能停在玻璃上。可铁炉的烟囱还断着，一生火烟就会灌满阁楼。', 'The skylight is fixed and the snow stays on the glass. But the stovepipe is still broken; a fire now would fill the attic with smoke.'],
      lines: [[D, '妈妈，现在可以生火了吗？', 'Mom, can we light a fire now?'], [M, '还不行，先把烟囱接上，不然会呛到你。', 'Not yet. Pipe first, or the smoke will choke you.']] },
    { title: ['烟有路走了', 'The smoke has a way out'], text: ['烟囱接通了，冷风顺着管子呜呜作响。阁楼里还是冷冰冰的，该让铁炉亮起来了。', 'The pipe is connected and the wind hums through it. The attic is still freezing. Time to wake the stove.'],
      lines: [[D, '我的手指冻得弯不过来了。', "My fingers are too cold to bend."], [M, '再忍一下，火马上就来。', 'Hold on a little. The fire is coming.']] },
    { title: ['炉火映红了墙', 'Firelight on the walls'], text: ['铁炉终于烧旺了，小暖的脸颊也红了起来。可角落的被褥又湿又硬，今晚还没法睡。', 'The stove is roaring and Nuan\u2019s cheeks turn pink. But the bedding in the corner is damp and stiff, no good for sleeping.'],
      lines: [[D, '好暖和……可是我好困。', 'So warm\u2026 but I am so sleepy.'], [M, '妈妈这就给你铺一张软软的床。', "I'll make you a soft bed right now."]] },
    { title: ['最后一件事', 'One last thing'], text: ['被褥铺好了，小暖裹在里面只露出脑袋。妈妈翻出背包里最后一点土豆和干菜。', 'The bed is made and Nuan peeks out from the quilt. Mom finds the last potatoes and dried greens in the backpack.'],
      lines: [[D, '我肚子咕咕叫了。', 'My tummy is rumbling.'], [M, '喝一碗热汤，我们就能安心睡到天亮。', 'A bowl of soup, and we can sleep until morning.']] },
  ],
  [ // stone hut: window, pot, hearth, bunk, soup
    { title: ['雨打不进来了', 'The rain stays out'], text: ['破窗洞封住了，雨点只能敲在木板上。石屋里有个旧火塘，可吊锅的铁链断了。', 'The window hole is boarded up and the rain only drums on the planks. There is an old hearth, but the pot chain is broken.'],
      lines: [[D, '我们今晚吃什么呀？', 'What are we eating tonight?'], [M, '先把吊锅挂好，才能煮东西。', 'First we hang the pot, then we can cook.']] },
    { title: ['等一把火', 'Waiting for a fire'], text: ['吊锅稳稳地挂在火塘上方。小暖从墙角翻出一捆还算干的木柴。', 'The pot hangs steady over the hearth. Nuan digs out a bundle of fairly dry firewood from the corner.'],
      lines: [[D, '柴我找到了！', 'I found the firewood!'], [M, '好孩子，我们来生火。', "Good girl. Let's light it."]] },
    { title: ['石墙暖起来', 'Warm stone walls'], text: ['火塘噼啪作响，湿衣服冒着白汽。窗外风雨未停，石床上却只有一层冷稻草。', 'The hearth crackles and their wet clothes steam. The storm goes on, and the stone bunk has only cold straw.'],
      lines: [[D, '石头床会不会很硬？', 'Will a stone bed be hard?'], [M, '铺厚一点，就像家里的一样。', "We'll make it thick, just like at home."]] },
    { title: ['锅里咕嘟响', 'The pot bubbles'], text: ['床铺好了。吊锅里的水开始冒泡，妈妈把带来的蘑菇和面疙瘩放了进去。', 'The bunk is ready. The water in the pot begins to bubble, and Mom drops in mushrooms and dumplings.'],
      lines: [[D, '我来搅！我来搅！', 'Let me stir! Let me stir!'], [M, '小心烫，慢慢搅。', 'Careful, it is hot. Stir slowly.']] },
  ],
  [ // lake hut: tarp, floor, stove, bed, stew
    { title: ['风被挡在外面', 'The wind is blocked'], text: ['防水布挂好了，湖风被挡在外面。可地板上有个大洞，能看见下面黑黑的湖水。', 'The tarp is up and the lake wind stays out. But there is a big hole in the floor, dark water below.'],
      lines: [[D, '妈妈，下面有鱼在游！', 'Mom, there are fish down there!'], [M, '那也不能掉下去，我们先把洞补上。', "Still, no falling in. Let's patch the hole."]] },
    { title: ['脚下踏实了', 'Solid ground'], text: ['地板补好了，小暖终于敢在屋里跑来跑去。角落那只小铁炉落满了灰。', 'The floor is patched and Nuan runs around at last. The little stove in the corner is covered in dust.'],
      lines: [[D, '这个炉子还能用吗？', 'Does this stove still work?'], [M, '擦一擦，应该还能烧。', 'Give it a wipe. It should still burn.']] },
    { title: ['湖面映着火光', 'Fire on the lake'], text: ['铁炉点着了，窗外的湖面映出一点橘色的光。太阳落山了，夜晚会比白天冷得多。', 'The stove is lit and the lake glows orange outside. The sun is setting; the night will be much colder.'],
      lines: [[D, '今晚我想挨着炉子睡。', 'I want to sleep by the stove tonight.'], [M, '那就把床铺在炉子旁边。', "Then we'll make the bed right beside it."]] },
    { title: ['渔夫的鱼竿', "The fisherman's rod"], text: ['床铺好了。门后挂着一根旧鱼竿，小暖在冰洞边钓上了一条小鱼。', 'The bed is ready. An old rod hangs behind the door, and Nuan catches a small fish at the ice hole.'],
      lines: [[D, '看！我钓到晚饭了！', 'Look! I caught dinner!'], [M, '那今晚就喝你钓的鱼汤。', "Then tonight we eat the stew you caught."]] },
  ],
  [ // farmhouse: door, hearth, fire, quilt, breakfast
    { title: ['门关上了', 'The door shuts'], text: ['门板重新立了起来，雪被挡在门外。灶台里塞满了旧灰和鸟窝。', 'The door stands again and the snow stays out. The hearth is stuffed with old ash and a bird nest.'],
      lines: [[D, '灶台里有个空鸟窝！', "There's an empty nest in the hearth!"], [M, '小鸟早就飞走了，我们把它清干净。', "The birds flew off long ago. Let's clear it."]] },
    { title: ['外婆的灶台', "Grandma's hearth"], text: ['灶台清通了，露出外婆刻在砖上的小花，和妈妈讲过的一模一样。', 'Under the ash is a little flower Grandma carved in the brick, just like in Mom\u2019s stories.'],
      lines: [[D, '妈妈小时候也在这里烤过火吗？', 'Did you warm up here when you were little?'], [M, '嗯，就在这里。我们把火生起来吧。', "Right here. Let's light the fire."]] },
    { title: ['老屋醒过来了', 'The old house wakes'], text: ['灶火一亮，整间农舍都暖了。柜子里还收着外婆缝的碎花被。', 'With the fire lit, the whole farmhouse warms up. Grandma\u2019s flowered quilt is still folded in the cupboard.'],
      lines: [[D, '这是外婆的被子！', "It's Grandma's quilt!"], [M, '外婆一定希望我们盖着它。', 'Grandma would want us to use it.']] },
    { title: ['天快亮了', 'Almost dawn'], text: ['碎花被铺好了。天边泛起鱼肚白，母女俩一夜没合眼。', 'The quilt is laid out. The sky turns pale; they have been up all night.'],
      lines: [[D, '我们做顿早餐吧，像真正的家一样。', "Let's make breakfast, like a real home."], [M, '好，就做你最爱吃的煎饼。', 'Okay. Your favourite pancakes.']] },
  ],
];
/** Between homes (index = the home just finished); the last entry is the ending. */
const JOURNEY = [
  { title: ['天亮出发', 'Off at sunrise'], text: ['第二天清晨雪停了。母女俩给阁楼留下一张纸条：\u201c这不是我们的家，给下一个没地方去的人留着吧。\u201d午后忽然下起暴风雨，路边只有一间破石屋。', 'By morning the snow has stopped. They leave a note in the attic: \u201cThis is not our home. Keep it for the next person with nowhere to go.\u201d In the afternoon a storm breaks, and the only shelter is a ruined stone hut.'],
    lines: [[D, '妈妈，那边有房子！', 'Mom, there is a house over there!'], [M, '窗都破了……没关系，我们会修。', "The window is smashed\u2026 That's okay. We can fix it."]] },
  { title: ['雨后的山路', 'After the storm'], text: ['暴风雨过去，石屋的火塘留给了下一个赶路的人。山路变得泥泞，傍晚她们走到一片结了薄冰的湖边，岸上有间被风吹烂的渔屋。', 'The storm passes, and the stone hut\u2019s hearth is left for the next traveller. The road turns to mud. At dusk they reach a lake with thin ice, and a wind-torn fishing hut on the shore.'],
    lines: [[D, '外婆家还远吗？', "Is Grandma's house still far?"], [M, '绕过这片湖就不远了。今晚先住这儿。', 'Just past the lake. We stay here tonight.']] },
  { title: ['最后一段路', 'The last stretch'], text: ['天还没亮她们就出发了，渔屋的炉子也留给了后来的人。山坡上终于出现了外婆的农舍，和地图上画着心的那间一模一样。可屋里没有灯，门板也倒在雪里。', 'They set off before dawn, leaving the fishing hut\u2019s stove for whoever comes next. At last Grandma\u2019s farmhouse appears on the hill, just like the house with the heart on the map. But it is dark inside and the door lies in the snow.'],
    lines: [[D, '外婆不在家吗？', "Isn't Grandma home?"], [M, '外婆早就不在了，老屋空了很多年。这里以后就是我们的家，我们把它修好。', 'Grandma passed away long ago, and the house has stood empty for years. This will be our home now, so we fix it up.']] },
  { title: ['给下一个人留灯', 'A lamp for the next one'], text: ['老屋修好了，窗、灶火和碎花被都是母女俩亲手修的。天黑以后，她们在窗台上点起一盏灯，留给同样在雪夜里赶路的人。', 'The old house is mended: the window, the hearth fire and the flowered quilt, all by their own hands. When night falls, they set a lamp on the windowsill for anyone else walking through a snowy night.'],
    lines: [[D, '妈妈，为什么要点灯呀？', 'Mom, why are we lighting a lamp?'], [M, '给和我们一样，在雪夜里赶路的人。', 'For people like us, out walking on a snowy night.'], [D, '那他们看到灯，就不怕了！', "Then when they see it, they won't be scared!"]] },
];

const LINE_MS = 2600;      // auto-advance per line: long enough to read, short enough to never stall play
const FIRST_LINE_MS = 3000; // a 4-line opening clears in ~10.8 s while the player is already solving

/**
 * Styles travel with the module (injected once) so the multi-file release and the
 * offline single-file build both get them without touching the packager.
 * Sizes use --su (1% of the scene picture width, set from JS) so the unit scales with the scene.
 */
const CSS = `
.story-strip{--su:3.6px;--av:clamp(34px,calc(var(--su)*13),64px);position:absolute;z-index:3;top:0;left:0;display:flex;align-items:center;gap:calc(var(--su)*1.6);pointer-events:none;box-sizing:border-box;width:max-content}
.story-strip[hidden]{display:none}
.story-strip[data-avatar="right"]{flex-direction:row-reverse}
.story-side{flex:none;display:flex;flex-direction:column;align-items:center;gap:3px}
.story-strip[data-variant="tiny"] .story-avatar{display:none}
.story-avatar{flex:none;width:var(--av);height:var(--av);object-fit:cover;object-position:50% 12%;border-radius:50%;background:radial-gradient(circle at 50% 38%,#fff6e6,#f3d9b6);border:3px solid #fff8ec;box-shadow:0 3px 0 #c99a55,0 6px 14px #3a26122e;pointer-events:auto;cursor:pointer}
.story-strip[data-variant="compact"]{--av:34px}
.story-strip[data-who="daughter"] .story-avatar{border-color:#fff1f4;box-shadow:0 3px 0 #d58aa0,0 6px 14px #3a26122e}
.story-bubble{--tail:50%;--edge:#e3c79c;position:relative;flex:0 1 auto;min-width:0;padding:clamp(5px,calc(var(--su)*1.9),10px) clamp(8px,calc(var(--su)*2.8),14px);background:#fff8ec;color:#4b3522;border:2px solid var(--edge);border-radius:14px;box-shadow:0 3px 0 #d8b886,0 8px 18px #3a26122b;font-size:clamp(11px,calc(var(--su)*3.7),16px);line-height:1.32;pointer-events:auto;cursor:pointer;text-align:left;overflow-wrap:anywhere}
.story-bubble::after{content:"";position:absolute;width:12px;height:12px;background:inherit;transform:rotate(45deg);border:0 solid var(--edge)}
.story-strip[data-tail="right"] .story-bubble::after{right:-8px;top:calc(var(--tail) - 6px);border-top-width:2px;border-right-width:2px;border-radius:0 3px 0 0}
.story-strip[data-tail="left"] .story-bubble::after{left:-8px;top:calc(var(--tail) - 6px);border-bottom-width:2px;border-left-width:2px;border-radius:0 0 0 3px}
.story-strip[data-tail="bottom"] .story-bubble::after{bottom:-8px;left:calc(var(--tail) - 6px);border-right-width:2px;border-bottom-width:2px;border-radius:0 0 3px 0}
.story-strip[data-tail="top"] .story-bubble::after{top:-8px;left:calc(var(--tail) - 6px);border-left-width:2px;border-top-width:2px;border-radius:3px 0 0 0}
.story-strip[data-who="daughter"] .story-bubble{--edge:#efbccb;background:#fff3f5;box-shadow:0 3px 0 #e2a4b6,0 8px 18px #3a26122b}
.story-name{display:block;font-size:.72em;letter-spacing:1px;color:#a0662a;margin-bottom:1px}
.story-strip[data-variant="compact"] .story-name,.story-strip[data-variant="tiny"] .story-name{display:none}
.story-strip[data-who="daughter"] .story-name{color:#b85a78}
.story-text{display:block;font-weight:650}
.story-skip{position:relative;min-height:0;min-width:0;margin:0;padding:1px 7px;font-size:clamp(9px,calc(var(--su)*2.6),11px);line-height:1.45;border-radius:999px;border:1px solid #e3c79c;background:#fffdf8e6;color:#8a6a45;pointer-events:auto;box-shadow:none;white-space:nowrap}
.story-skip::before{content:"";position:absolute;inset:-8px -4px}
.story-in .story-avatar{animation:story-avatar .34s cubic-bezier(.2,1.5,.4,1) both}
.story-in .story-bubble{animation:story-bubble .38s .05s cubic-bezier(.2,1.4,.4,1) both}
.story-moved .story-bubble,.story-moved .story-side{animation:story-moved .22s ease-out both}
@keyframes story-avatar{from{opacity:0;transform:translateY(-10px) scale(.7)}to{opacity:1;transform:none}}
@keyframes story-bubble{from{opacity:0;transform:translateY(-6px) scale(.86)}to{opacity:1;transform:none}}
@keyframes story-moved{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.story-in .story-avatar,.story-in .story-bubble,.story-moved .story-bubble,.story-moved .story-side{animation:none}}
/* Option B (2026-10-19): full-width snow-capped card (same frame as the task card) docked right above the task card. */
.story-strip.story-card{--av:58px;max-width:none!important;flex-direction:row!important}
.story-strip.story-card .story-avatar{display:block}
.story-strip.story-card .story-bubble{flex:1 1 auto;background:none!important;box-shadow:none!important;border:0 solid transparent;border-width:11px 15px 9px;padding:4px 6px 3px;border-image:var(--ui-hud-card) 40 48 30 fill / 11px 15px 9px stretch;color:#3B3550;filter:drop-shadow(0 3px 6px #0a143073)}
.story-strip.story-card .story-bubble::after{display:none}
.story-strip.story-card .story-name{display:inline-block;margin:0 0 3px;padding:1px 10px 2px;border-radius:99px;background:#F7C9D4;color:#8A3A55;font-size:12px;font-weight:900;letter-spacing:1px}
.story-strip.story-card .story-text{font-size:15px}
`;
function ensureStyles() {
  if (document.querySelector('style[data-story-css]')) return;
  const style = document.createElement('style');
  style.dataset.storyCss = '';
  style.textContent = CSS;
  document.head.append(style);
}

const sceneRoot = () => document.getElementById('scene')?.closest('.scene-wrap') || document.getElementById('scene')?.parentElement || null;
const pageLang = () => (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
const pageAsset = p => window.__ASSETS__?.[p] || p;
/** audio.js listens for this and plays the bubble pop, so story and audio stay decoupled. */
const announce = who => window.dispatchEvent(new CustomEvent('rescue-story-bubble', { detail: { who } }));

const PAD = 6;        // inset from the scene picture edge
const GAP = 8;        // clearance kept between the strip and any head box
const MIN_BUBBLE = 84; // narrowest readable bubble (px)
const hit = (a, b, m = 0) => a[0] < b[0] + b[2] + m && b[0] < a[0] + a[2] + m && a[1] < b[1] + b[3] + m && b[1] < a[1] + a[3] + m;
const area = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

/** Scene geometry in the strip host's coordinates, or null before the scene has rendered. */
function sceneGeometry(host) {
  const canvas = document.getElementById('scene'), f = window.__RESCUE_SCENE__?.faces;
  if (!canvas || !host) return null;
  const c = canvas.getBoundingClientRect(), h = host.getBoundingClientRect();
  if (!c.width || !c.height) return null;
  const ox = c.left - h.left - host.clientLeft, oy = c.top - h.top - host.clientTop;
  const shift = b => b && [b[0] + ox, b[1] + oy, b[2], b[3]];
  const region = [ox + PAD, oy + PAD, c.width - PAD * 2, c.height - PAD * 2];
  if (!f) return { region, width: c.width, faces: null };
  return {
    region, width: c.width, hug: !!f.hug,
    faces: { mother: shift(f.mother), daughter: shift(f.daughter) },
    spans: { mother: shift(f.motherSpan), daughter: shift(f.daughterSpan) },
  };
}

export function createStory({ root = sceneRoot, asset = pageAsset, lang = pageLang, onBubble = announce } = {}) {
  const stats = { shown: 0, beats: {}, skipped: 0, advanced: 0, auto: 0, lines: [],
    placements: 0, replaced: 0, overlapFrames: 0, framesChecked: 0, placement: null };
  let queue = [], timer = null, el = null, comfortIndex = 0, lineMs = LINE_MS, firstMs = FIRST_LINE_MS;
  let raf = null, lastSpanCheck = 0, resizeObs = null;
  const seen = new Set();

  function build() {
    const host = typeof root === 'function' ? root() : root;
    if (el) { if (!el.isConnected && host) host.append(el); return el; }
    if (!host) return null;
    ensureStyles();
    el = document.createElement('div');
    el.className = 'story-strip';
    el.hidden = true;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="story-side"><img class="story-avatar" alt=""><button type="button" class="story-skip"></button></div><div class="story-bubble"><b class="story-name"></b><span class="story-text"></span></div>';
    el.querySelector('.story-bubble').addEventListener('click', event => { event.stopPropagation(); stats.advanced++; next(); });
    el.querySelector('.story-avatar').addEventListener('click', event => { event.stopPropagation(); stats.advanced++; next(); });
    el.querySelector('.story-skip').addEventListener('click', event => { event.stopPropagation(); stats.skipped++; clear(); });
    host.append(el);
    if (typeof ResizeObserver === 'function') {
      resizeObs = new ResizeObserver(() => { if (el && !el.hidden) place(true); });
      resizeObs.observe(host);
    }
    return el;
  }
  /** Speaker's current head box (host coords), used to pick the side and aim the tail. */
  function speakerBox(geo) {
    return geo?.faces?.[el?.dataset.who === D ? 'daughter' : 'mother'] || null;
  }
  /** Try one corner/variant: size the strip for the free width there, then verify it. */
  function tryCorner(geo, corner, variant) {
    const [rx, ry, rw, rh] = geo.region;
    const spans = geo.spans ? [geo.spans.mother, geo.spans.daughter] : [];
    const left = corner.endsWith('left'), top = corner.startsWith('top');
    el.dataset.variant = variant;
    el.dataset.avatar = left ? 'left' : 'right';
    el.style.maxWidth = 'none';
    const cap = Math.min(rw * .66, 320);
    let width = cap, box = null;
    // Free width depends on which heads share the strip's rows; refine twice with the measured height.
    let height = 64;
    for (let pass = 0; pass < 3; pass++) {
      const band = top ? [ry, ry + height] : [ry + rh - height, ry + rh];
      let free = cap;
      for (const s of spans) {
        if (!s || s[1] >= band[1] + GAP || s[1] + s[3] <= band[0] - GAP) continue;
        free = Math.min(free, left ? s[0] - GAP - rx : rx + rw - (s[0] + s[2]) - GAP);
      }
      width = Math.floor(free);
      if (width < 40) return null;
      el.style.maxWidth = width + 'px';
      const w = el.offsetWidth, h = el.offsetHeight;
      box = [left ? rx : rx + rw - w, top ? ry : ry + rh - h, w, h];
      if (Math.abs(h - height) < 1) break;
      height = h;
    }
    const bubble = el.querySelector('.story-bubble').offsetWidth;
    if (!box || box[2] > width + 1 || (variant !== 'tiny' && bubble < MIN_BUBBLE) || box[3] > rh) return null;
    const clear = spans.every(s => !s || !hit(box, s, GAP - 1));
    return { corner, variant, box, clear, overlap: spans.reduce((sum, s) => sum + (s ? area(box, s) : 0), 0) };
  }
  /** Option B: full-width card docked just above the task card (or the bottom of the scene picture). */
  function place(moved = false) {
    if (!el || el.hidden) return;
    const host = el.parentElement, geo = sceneGeometry(host);
    if (!geo) return;
    el.style.setProperty('--su', (geo.width / 100).toFixed(2) + 'px');
    el.classList.add('story-card');
    el.dataset.variant = 'normal';
    el.dataset.avatar = 'left';
    const c = document.getElementById('scene').getBoundingClientRect(), h = host.getBoundingClientRect();
    const ox = c.left - h.left - host.clientLeft, oy = c.top - h.top - host.clientTop;
    const task = document.querySelector('.task-heading')?.getBoundingClientRect();
    const dock = task && task.height && task.top < c.bottom && task.bottom > c.top ? task.top - h.top - host.clientTop - 4 : oy + c.height - PAD;
    // Share the task card's left/right edges so the two cards line up exactly (fallback: scene width minus 8px each side).
    const docked = task && task.width && task.top < c.bottom && task.bottom > c.top;
    const left = docked ? task.left - h.left - host.clientLeft : ox + 8, width = docked ? task.width : c.width - 16;
    el.style.width = width + 'px';
    const box = [left, Math.max(oy + PAD, dock - el.offsetHeight), width, el.offsetHeight];
    el.style.left = Math.round(box[0]) + 'px';
    el.style.top = Math.round(box[1]) + 'px';
    stats.placement = { corner: 'dock', variant: 'card', clear: true, box: box.map(Math.round) };
    stats.placements++;
  }
  /** Previous corner placement (v10), kept for reference; no longer called. */
  function placeCorner(moved = false) {
    if (!el || el.hidden) return;
    const host = el.parentElement, geo = sceneGeometry(host);
    if (!geo) return;
    el.style.setProperty('--su', (geo.width / 100).toFixed(2) + 'px');
    const sp = speakerBox(geo);
    const cx = sp ? sp[0] + sp[2] / 2 : geo.region[0] + geo.region[2];
    const speakerRight = cx > geo.region[0] + geo.region[2] / 2;
    const opposite = speakerRight ? 'left' : 'right', same = speakerRight ? 'right' : 'left';
    const corners = [`top-${opposite}`, `top-${same}`, `bottom-${opposite}`, `bottom-${same}`];
    let best = null;
    for (const variant of ['normal', 'compact', 'tiny']) {
      for (const corner of corners) {
        const t = tryCorner(geo, corner, variant);
        if (!t) continue;
        if (t.clear) { best = t; break; }
        if (!best || t.overlap < best.overlap) best = t;
      }
      if (best?.clear) break;
    }
    if (!best) best = { corner: `top-${opposite}`, variant: 'tiny', box: null, clear: false };
    // Re-apply the winner (tryCorner leaves the last attempt's sizing on the element).
    tryCorner(geo, best.corner, best.variant);
    const box = best.box || [geo.region[0], geo.region[1], el.offsetWidth, el.offsetHeight];
    el.style.left = Math.round(box[0]) + 'px';
    el.style.top = Math.round(box[1]) + 'px';
    aim(geo, box);
    const prev = stats.placement;
    stats.placement = { corner: best.corner, variant: best.variant, clear: best.clear, box: box.map(Math.round) };
    stats.placements++;
    if (moved && prev && (prev.corner !== best.corner || prev.variant !== best.variant)) {
      stats.replaced++;
      el.classList.remove('story-moved'); void el.offsetWidth; el.classList.add('story-moved');
    }
  }
  /** Tail on the bubble edge facing the speaker's face, slid toward it along that edge. */
  function aim(geo, box) {
    const sp = speakerBox(geo), bubble = el.querySelector('.story-bubble');
    if (!sp || !bubble) { el.dataset.tail = el.dataset.avatar === 'left' ? 'right' : 'left'; return; }
    const bx = box[0] + bubble.offsetLeft, by = box[1] + bubble.offsetTop, bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const fx = sp[0] + sp[2] / 2, fy = sp[1] + sp[3] / 2;
    let side;
    if (fx > bx + bw && el.dataset.avatar !== 'right') side = 'right';
    else if (fx < bx && el.dataset.avatar !== 'left') side = 'left';
    else side = fy > by + bh / 2 ? 'bottom' : 'top';
    const along = side === 'right' || side === 'left' ? fy - by : fx - bx, len = side === 'right' || side === 'left' ? bh : bw;
    el.dataset.tail = side;
    bubble.style.setProperty('--tail', Math.round(Math.max(12, Math.min(len - 12, along))) + 'px');
  }
  /** Every frame while visible: never let a face touch the strip. */
  function watch() {
    raf = null;
    if (!el || el.hidden) return;
    if (el.classList.contains('story-card')) return; // docked card: faces never matter, nothing to re-check
    const geo = sceneGeometry(el.parentElement);
    if (geo?.faces) {
      const host = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect();
      const box = [r.left - host.left - el.parentElement.clientLeft, r.top - host.top - el.parentElement.clientTop, r.width, r.height];
      stats.framesChecked++;
      const touching = [geo.faces.mother, geo.faces.daughter].some(f => f && hit(box, f));
      const now = performance.now();
      const risky = now - lastSpanCheck > 120 && [geo.spans.mother, geo.spans.daughter].some(s => s && hit(box, s));
      if (risky) lastSpanCheck = now;
      if (touching || risky || box[0] < geo.region[0] - PAD - 1 || box[1] < geo.region[1] - PAD - 1 ||
          box[0] + box[2] > geo.region[0] + geo.region[2] + PAD + 1 || box[1] + box[3] > geo.region[1] + geo.region[3] + PAD + 1) {
        place(true);
        const r2 = el.getBoundingClientRect();
        const box2 = [r2.left - host.left - el.parentElement.clientLeft, r2.top - host.top - el.parentElement.clientTop, r2.width, r2.height];
        if ([geo.faces.mother, geo.faces.daughter].some(f => f && hit(box2, f))) stats.overlapFrames++;
      } else if (stats.placement) {
        aim(geo, box);
      }
    }
    raf = requestAnimationFrame(watch);
  }
  function name(who) {
    const zh = lang() === 'zh';
    if (who === F) return zh ? '爸爸' : 'Dad';
    return who === M ? (zh ? '妈妈' : 'Mom') : (zh ? '小暖' : 'Nuan');
  }
  function localize(entry) {
    if (!entry) return null;
    const k = lang() === 'zh' ? 0 : 1;
    return { title: entry.title[k], text: entry.text[k],
      lines: (entry.lines || []).map(([who, zh, en]) => ({ who, name: name(who), text: k ? en : zh,
        avatar: asset(`assets/avatar-${who}.webp`) })) };
  }
  function show(line, first) {
    const box = build();
    if (!box) return;
    const [who, zh, en] = line;
    const text = lang() === 'zh' ? zh : en;
    const avatar = box.querySelector('.story-avatar');
    avatar.src = asset(`assets/avatar-${who}.webp`);
    box.dataset.who = who;
    box.querySelector('.story-name').textContent = name(who);
    box.querySelector('.story-text').textContent = text;
    const skip = box.querySelector('.story-skip');
    skip.textContent = lang() === 'zh' ? (queue.length ? '跳过' : '关闭') : (queue.length ? 'Skip' : 'Close');
    skip.setAttribute('aria-label', skip.textContent);
    box.hidden = false;
    place(false);
    box.classList.remove('story-in');
    void box.offsetWidth;
    box.classList.add('story-in');
    stats.shown++;
    stats.lines.push(`${who}:${text}`);
    if (stats.lines.length > 40) stats.lines.shift();
    onBubble(who);
    clearTimeout(timer);
    timer = setTimeout(() => { stats.auto++; next(); }, first ? firstMs : lineMs);
    if (raf === null) raf = requestAnimationFrame(watch);
  }
  function next() {
    clearTimeout(timer);
    timer = null;
    const line = queue.shift();
    if (!line) { hide(); return; }
    show(line, false);
  }
  function hide() {
    clearTimeout(timer);
    timer = null;
    if (el) { el.hidden = true; el.classList.remove('story-in', 'story-moved'); }
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  }
  function clear() { queue = []; hide(); }
  function play(beat, lines, delay = 0, pace = {}) {
    if (!lines?.length) return;
    stats.beats[beat] = (stats.beats[beat] || 0) + 1;
    const begin = () => { lineMs = pace.lineMs ?? LINE_MS; firstMs = pace.firstMs ?? FIRST_LINE_MS; queue = lines.slice(1); show(lines[0], true); };
    clearTimeout(timer);
    queue = [];
    hide();
    if (delay) timer = setTimeout(begin, delay); else begin();
  }

  return {
    /** Chapter opening: shown when a chapter's first repair starts (once per chapter per session unless forced). */
    opening(chapter, { force = false, delay = 450 } = {}) {
      const key = `open-${chapter}`;
      if (!force && seen.has(key)) return false;
      seen.add(key);
      play('opening', OPENING[chapter % OPENING.length], delay);
      return true;
    },
    /** One line once a repair is completed; the chapter's last repair hands over to chapterDone instead. */
    repaired(chapter, task, { delay = 900 } = {}) {
      const own = REPAIRED_HOME[chapter % 4]?.[task];
    if (own) { play('repaired', [own], delay); return; }
      const options = REPAIRED[task % REPAIRED.length];
      play('repaired', [options[chapter % options.length]], delay);
    },
    /** Act II (act=1) / III (act=2): two lines after the act title card, once per home per session. */
    act(chapter, act, { delay = 700 } = {}) {
      const lines = ACT[chapter % ACT.length]?.[act - 1], key = `act-${chapter}-${act}`;
      if (!lines || seen.has(key)) return false;
      seen.add(key);
      play('act', lines, delay, { firstMs: 2800, lineMs: 2600 });
      return true;
    },
    /** Two lines, paced to finish before the result card (opens ~5.4 s after the last placement). */
    chapterDone(chapter, { delay = 900 } = {}) {
      play('chapterDone', CHAPTER_DONE[chapter % CHAPTER_DONE.length], delay, { firstMs: 2200, lineMs: 2200 });
    },
    comfort({ delay = 450 } = {}) {
      play('comfort', [COMFORT[comfortIndex++ % COMFORT.length]], delay, { firstMs: 2800 });
    },
    /** Story card text between two levels of one home (task = the repair just finished, 0..3). */
    bridge(chapter, task) { return localize(BRIDGE[chapter]?.[task]); },
    /** Travel text after a home is finished (chapter 0..2), or the ending (chapter 3). */
    journey(chapter) { return localize(JOURNEY[chapter]); },
    /** Narration that opens a home: the prologue for home 1, the previous journey for the others. */
    prologue(chapter) { return chapter > 0 ? localize(JOURNEY[chapter - 1]) : localize(PROLOGUE); },
    /** The five illustrated prologue scenes before chapter 1 ({img, title, text, lines}). */
    prologueScenes() { return PROLOGUE_SCENES.map(s => ({ img: s.img, ...localize(s) })); },
    clear,
    /** Re-run placement (e.g. after a layout change the observer cannot see). */
    reflow: () => place(true),
    get visible() { return !!el && !el.hidden; },
    stats: () => ({ ...stats, beats: { ...stats.beats }, lines: [...stats.lines], visible: !!el && !el.hidden, queued: queue.length,
      placement: stats.placement && { ...stats.placement } }),
  };
}

/** One shared instance; app.js reaches it through this global from inside its existing functions. */
const story = createStory();
if (!('__RESCUE_STORY__' in window)) Object.defineProperty(window, '__RESCUE_STORY__', { value: story, configurable: false });
export default story;
