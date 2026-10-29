const pick=(a,r)=>a[Math.floor(r()*a.length)];
const gcd=(a,b)=>b?gcd(b,a%b):a;
const ratio=(a,b)=>{let g=gcd(a,b);return `${a/g} : ${b/g}`};
export function generate(r=Math.random){
 const pair=()=>pick([[2,3],[3,4],[4,5],[3,5],[5,7],[7,9]],r);
 const make=(title,text,answer,wrong,solution,seconds)=>{
  const choices=[...new Set([answer,...wrong])];let n=2;while(choices.length<4) {const s=`${n++}`;if(!choices.includes(s))choices.push(s)}
  choices.length=4;for(let i=3;i>0;i--){let j=Math.floor(r()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]]}
  return {title,text,choices,correct:choices.indexOf(answer),solution,seconds};
 };
 let [a,b]=pair(), shape=pick(['三角形','長方形','五邊形'],r);
 const q1=make('面積比',`兩個相似${shape}的對應邊長比為 ${a} : ${b}，求面積比（小 : 大）。`,ratio(a*a,b*b),[ratio(a,b),ratio(a**3,b**3),ratio(b*b,a*a)],`面積比 = 邊長比的平方 = ${a}² : ${b}² = ${ratio(a*a,b*b)}。`,40);
 [a,b]=pair();const q2=make('反求邊長比',`兩個相似平面圖形的面積比為 ${a*a} : ${b*b}，求對應邊長比。`,ratio(a,b),[ratio(a*a,b*b),ratio(b,a),ratio(a,b*b)],`邊長比 = √${a*a} : √${b*b} = ${ratio(a,b)}。`,40);
 [a,b]=pair();let k=pick([2,3,4,5],r),small=a*a*k,big=b*b*k;
 const q3=make('求未知面積',`兩個相似長方形的對應邊長為 ${a*2} cm 和 ${b*2} cm。較小圖形面積為 ${small} cm²，求較大圖形面積。`,`${big} cm²`,[`${a*b*k} cm²`,`${big+small} cm²`,`${big*2} cm²`],`面積 = ${small} × (${b*2}/${a*2})² = ${big} cm²。`,50);
 [a,b]=pair();k=pick([2,3,4],r);let side=a*k;
 const q4=make('反求未知邊長',`相似圖形 A、B 的面積分別為 ${a*a*3} cm²、${b*b*3} cm²。A 的一條邊為 ${side} cm，求 B 的對應邊長。`,`${b*k} cm`,[`${b*k+1} cm`,`${b*k*2} cm`,`${side} cm`],`邊長比 A : B = ${a} : ${b}；B 的邊長 = ${side} × ${b}/${a} = ${b*k} cm。`,60);
 let scale=pick([1000,2000,3000,5000],r),map=pick([2,3,4,6,8],r),actual=map*scale*scale/10000;
 const q5=make('比例尺與單位',`某${pick(['公園','運動場','自然保護區'],r)}平面圖比例尺為 1 : ${scale.toLocaleString('en-US')}。實際面積為 ${actual.toLocaleString('en-US')} m²，求圖上面積（cm²）。`,`${map} cm²`,[`${map*10} cm²`,`${map*100} cm²`,`${map/10} cm²`],`1 m² = 10,000 cm²。圖上面積 = ${actual} × 10,000 ÷ ${scale}² = ${map} cm²。比例尺要平方。`,70);
 return [q1,q2,q3,q4,q5];
}
