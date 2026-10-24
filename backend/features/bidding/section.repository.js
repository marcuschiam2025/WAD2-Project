import Section from './models/Section.js'
import { canonicalTerm, termLabel, normalizeSection } from './utils/sectionData.js'

// Native reads retain fields from both catalogue schemas. This adapter never rewrites records.
export async function availableTerms() {
 const [old,shared]=await Promise.all([Section.collection.distinct('term'),Section.collection.distinct('termKey')])
 return [...new Set([...old,...shared].filter(Boolean).map(canonicalTerm))].sort().reverse()
}
export async function loadSections({term,modules,ids}={}) {
 const and=[]
 if(term) { const key=canonicalTerm(term);and.push({$or:[{term:key},{term:termLabel(key)},{termKey:key}]}) }
 if(modules?.length) and.push({$or:[{module:{$in:modules}},{moduleCode:{$in:modules}}]})
 if(ids) {
  const shared=ids.filter(id=>id.includes(':')).map(id=>{const [termKey,moduleCode,sectionCode,...rest]=id.split(':');if(rest.length||!sectionCode) throw new Error('Invalid section ID');return {termKey,moduleCode,sectionCode}})
  and.push({$or:[{sectionId:{$in:ids}},...shared]})
 }
 const rows=await Section.collection.find(and.length?{$and:and}:{}).toArray()
 return rows.map(normalizeSection).sort((a,b)=>a.module.localeCompare(b.module)||a.section.localeCompare(b.section))
}
export async function roundSettings(env=process.env) {
 const terms=await availableTerms()
 const term=env.BIDDING_TERM?canonicalTerm(env.BIDDING_TERM):terms[0]??null
 const closesAt=env.BIDDING_ROUND_CLOSES_AT?new Date(env.BIDDING_ROUND_CLOSES_AT):null
 if(closesAt && !Number.isFinite(closesAt.getTime())) throw new Error('Invalid BIDDING_ROUND_CLOSES_AT')
 return {term,round:env.BIDDING_ROUND||null,closesAt:closesAt?.toISOString()??null,availableTerms:terms,configured:!!env.BIDDING_TERM,source:env.BIDDING_TERM?'configured':'catalogue'}
}
