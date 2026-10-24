import { httpError } from '../../../middleware/errorHandler.js'
export function validateCartItems(items,balance) {
 if(!Array.isArray(items)) throw httpError(400,'items must be an array')
 const seen=new Set()
 let total=0
 for(const item of items) {
  if(!item || typeof item.module!=='string' || !item.module || typeof item.sectionId!=='string' || !item.sectionId) throw httpError(400,'Each bid needs a module and section')
  if(seen.has(item.module)) throw httpError(400,'Each module can only be in the cart once')
  seen.add(item.module)
  if(typeof item.amount!=='number'||!Number.isFinite(item.amount)||item.amount<10) throw httpError(400,'Every bid must be a finite number of at least e$ 10')
  total+=item.amount
 }
 if(total>balance) throw httpError(400,`e$ ${total} is more than your balance of e$ ${balance}`)
 return total
}
