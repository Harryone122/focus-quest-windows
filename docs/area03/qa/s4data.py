# HISTORICAL (Opus 2026-10-03): one-shot generator used for stage 4. Do NOT rerun - the scene JSON has been edited by hand since
# (p_seat bench, leaf_seat, seat fixes, texts) and is now the source of truth.
# Stage 4 data tables (SPEC 11, STAGE_4_5_DESIGN_DRAFT sections 2-4, 7, 9) -> merged into the scene JSON
def ev(id, spot, name, anim, dur, w, tide='any', **kw):
    d = {'id': id, 'spot': spot, 'name': name, 'anim': anim, 'dur': dur, 'weight': w, 'outcome': 'ambient'}
    if tide != 'any': d['tide'] = tide
    d.update(kw); return d
def note(text, tags): return {'outcome': 'note', 'note': text, 'tagGain': tags}
EVENTS = [
 ev('ev_gauge_read','r_gauge','數標尺上露出水面的刻線','inspect',[25,45],2),
 ev('ev_gauge_wipe','r_gauge','擦去標尺上的濕泥','reach',[30,50],1.2,'low',once=True,**note('標尺最高那道刻線，比我見過的任何一次潮水都高。',['MAP'])),
 ev('ev_boat_look','r_boat','看船裡的積水和撐篙','inspect',[25,40],2),
 ev('ev_boat_bail','r_boat','用手舀出船底的積水','crouch',[40,70],1,'low'),
 ev('ev_pool_fish','r_pool','蹲在潮池邊看小魚','crouch',[30,60],2.5,'low'),
 ev('ev_pool_shell','r_pool','撿一枚貝殼，排到小船的船舷上','pickup',[20,35],1.5,'low',worldMark='boatShells'),
 ev('ev_reeds_egret','r_reeds','安靜地看白鷺','gaze',[40,80],2,callEgret=True),
 ev('ev_reeds_wind','r_reeds','聽風吹過蘆葦','gaze',[30,50],1.5),
 ev('ev_pillar_touch','c_pillar','摸斷柱上的水痕','reach',[25,40],1.5),
 ev('ev_pillar_sit','c_pillar','坐在斷柱腳下休息','sitGaze',[45,90],1.5,'low'),
 ev('ev_stele_wipe','c_stele','擦去石面水痕','reach',[40,70],1.6,'low',once=True,effect='steleWipe',**note('水痕擦掉了，底下沒有字，只有更舊的水痕。',['ARCHIVE'])),
 ev('ev_stele_look','c_stele','端詳石碑','inspect',[20,35],1.5),
 ev('ev_column_sit','c_column','坐在倒柱上看湖','sitGaze',[45,90],2),
 ev('ev_breach_look','c_breach','蹲下看水下沉著的石板','crouch',[30,50],1.5),
 ev('ev_breach_pebble','c_breach','往破口丟一顆小石子','pickup',[15,25],1,'low',effect='pebble'),
 ev('ev_stair_notes','c_stair','坐在石階上整理筆記','write',[60,100],1.5,'low'),
 ev('ev_steps_sit','c_steps','坐著看石階一階一階沉進水裡','sitEdge',[60,100],2),
 ev('ev_steps_count','c_steps','數露出水面的台階','gaze',[20,35],1.2,'low',once=True,**note('退潮時沉階露出四階，下面還有很多。',['MAP'])),
 ev('ev_seat_sit','p_seat','在亭台南緣坐一會','sitGaze',[40,80],1.5),
 ev('ev_mirror_look','p_mirror','看破掉的鏡框','inspect',[20,35],1.5),
 ev('ev_mirror_wipe','p_mirror','用袖子擦那一角鏡片','reach',[25,40],1,once=True,requires='shardPresent',**note('鏡片照出來的亭子，好像比現在新。',['MEMORY'])),
 ev('ev_roots_sit','k_roots','坐在松根上','sitGaze',[45,90],2),
 ev('ev_roots_cone','k_roots','撿一顆松果，放到第四盞燈旁的岩石上','pickup',[15,30],1.2,worldMark='pineCones'),
 ev('ev_branch_gaze','k_branch','看長枝的枝尖垂向水面','gaze',[25,45],1.5),
 ev('ev_ring_look','s_ring','蹲在石環邊看靜止的水','crouch',[30,60],2),
 ev('ev_ring_count','s_ring','一顆一顆數環上的石頭','inspect',[30,50],1,once=True,noteAfterCore='石環有十四顆石頭。圈裡的水會動了。',**note('石環有十四顆石頭。圈裡的水連風都吹不動。',['MEMORY'])),
 ev('ev_pier_sit','n_pier','坐在燈旁的石墩上晃腳','sitEdge',[60,100],2,'low'),
 ev('ev_arch_look','a_arch','看遠方踏石淡進薄霞','gaze',[25,45],2),
 ev('ev_stones_hop','a_stones','跳一顆踏石再跳回來','hopStones',[15,25],2,'low'),
 ev('ev_far_gaze','b_far','看東方的薄霞','gaze',[30,60],2),
 ev('ev_pond_watch','leaf_watch','蹲著看睡蓮葉','crouch',[30,50],2),
 ev('ev_pond_touch','leaf_watch','輕撥腳邊的葉片','leafTouch',[25,40],1.5,'high'),
 ev('ev_pond_bloom','leaf_watch','看睡蓮一朵一朵打開','gaze',[40,70],3,'high',once=True,requires='flowersOpen',**note('水漲上來，池裡的睡蓮一朵一朵開了。',['MEMORY'])),
 ev('ev_seat_rest','leaf_seat','坐在池邊的石板上','sitGaze',[45,90],2,'low'),
 ev('ev_moon_look','moon_watch','看著橋洞','gazeDown',[30,60],2),
 ev('ev_moon_full','moon_watch','看橋洞和倒影合成一輪滿月','gaze',[40,70],3,'high',once=True,**note('水漲到拱腳，橋洞和倒影合成一輪滿月。圓裡是晚上。',['MEMORY'])),
 ev('ev_crown_stand','moon_crown','站在橋頂看水','gazeDown',[25,45],2),
 ev('ev_crown_night','moon_crown','低頭看腳下圓裡的月亮','gazeDown',[40,70],2.5,'high',time=['night']),
 ev('ev_bank_sit','moon_bank','坐在岸邊晃腳，看著橋','sitEdge',[60,100],2,'low'),
 ev('ev_banyan_root','moon_bank','摸垂下來的氣根','reach',[20,35],1.2),
]
RARE = [
 {'id':'rare_gauge_plate','rare':True,'tier':'journey','spot':'r_gauge','name':'在標尺腳邊撬下一片銅片','anim':'reachDown','weight':0,'tide':'low','source':'gauge','demoSeconds':16,'item':{'id':'tide_gauge_plate','name':'水位刻片','kind':'journey'},'outcome':'find'},
 {'id':'rare_boat_plate','rare':True,'tier':'journey','spot':'r_boat','name':'從小船座板下抽出一片銅片','anim':'reachDown','weight':0,'tide':'high','source':'boat','demoSeconds':16,'item':{'id':'tide_gauge_plate','name':'水位刻片','kind':'journey'},'variantOf':'rare_gauge_plate','outcome':'find'},
 {'id':'rare_mirror_shard','rare':True,'tier':'journey','spot':'p_mirror','name':'取下鏡框角落的鏡片','anim':'reach','weight':0,'source':'frame','demoSeconds':16,'item':{'id':'silvered_shard','name':'背銀鏡片','kind':'journey'},'outcome':'find'},
 {'id':'rare_ring_mirror','rare':True,'tier':'core','spot':'s_ring','name':'碰石環裡的水','anim':'crouch','weight':0,'source':'ring','demoSeconds':32,'item':{'id':'lake_mirror','name':'湖鏡','kind':'core'},'outcome':'find'},
]
REST = [
 {'id':'rest_cup_first','node':'p_seat','name':'翻開凳上倒扣的杯子，倒了茶，坐下慢慢喝','anim':'sequence','dur':[46,46],'weight':0,'once':True,'worldMark':'cupLeft'},
 {'id':'rest_notes','node':'p_seat','name':'坐著整理筆記','anim':'write','dur':[180,600],'weight':3},
 {'id':'rest_lake','node':'p_seat','name':'坐著看湖','anim':'sitGaze','dur':[120,300],'weight':2},
 {'id':'rest_tea','node':'p_seat','name':'再倒一杯茶，看著湖','anim':'drinkSit','dur':[90,200],'weight':1.2,'requires':'cupLeft'},
 {'id':'rest_mirror','node':'p_seat','name':'坐著看整片湖變成鏡子','anim':'sitGaze','dur':[120,300],'weight':4,'tide':'high','preferred':True},
]
DEPART = [
 {'id':'depart_arch','exit':'a_arch','exitNode':'a_arch','label':'石拱門','style':'stones',
  'offMap':[[-4.176,15.054,0.16],[-4.953,16.308,0.16],[-5.729,17.562,0.16],[-6.357,18.892,0.16],[-6.904,20.261,0.16],[-7.452,21.631,0.16],[-8.0,23.0,0.16]],
  'leaveMsg':'旅人跳過拱門下的水，沿著遠方的踏石走進西北的薄霞。'},
 {'id':'depart_east','exit':'b_far','exitNode':'b_far','label':'東方踏石','style':'stones',
  'offMap':[[15.623,3.629,0.16],[17.222,4.002,0.16],[18.819,4.382,0.16],[20.41,4.791,0.16],[22.0,5.2,0.16]],
  'leaveMsg':'旅人沿著長長的踏石往東走，越走越小，淡進東方的薄霞。'},
]
SPECIAL = {'journey':['rare_gauge_plate','rare_mirror_shard'],'journeyTideVariants':{'rare_gauge_plate':'rare_boat_plate'},'core':['rare_ring_mirror'],
 'note':'每次完整探索必得兩種旅程信物之一（可落在第 1–4 盞燈之間）；核心每盞燈 5%、第五次保底（保底由 App 做）。抽中水位刻片時，若旅人出發去取得的當下是滿潮，改播 rare_boat_plate（同一件物品、同一筆保存結果，只換取得地點）。'}
MARKS = {'gaugeCarving':'story（第 5 段）：標尺最高刻線旁的刻字露出來','cupLeft':'rest_cup_first 播完：之後亭台南緣一直放著那只杯子（正放），並開放 rest_tea','ringStill':'true = 石環裡的水永遠靜止；取得湖鏡後永久改為 false（石環裡的水會起漣漪）','boatShells':'ev_pool_shell 每次 +1（上限 10）：船舷上的貝殼','pineCones':'ev_roots_cone 每次 +1（上限 6）：第四盞燈旁岩上的松果','steleWiped':'ev_stele_wipe 之後：石碑水痕消失，到下一次滿潮結束才回來（不跨天）','persist':'gaugeCarving、cupLeft、ringStill、boatShells、pineCones 跨天保留'}
