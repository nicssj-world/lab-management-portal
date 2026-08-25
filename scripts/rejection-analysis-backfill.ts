import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const { analyzeRejectionData } = await import('../lib/rejection/analysis-server')
  const summary = await analyzeRejectionData({ fromYear: 2023 })
  console.log(JSON.stringify({
    total_other: summary.total_other,
    categorized_total: summary.categorized_total,
    no_detail_total: summary.no_detail_total,
    needs_review_total: summary.needs_review_total,
    merged_to_main_total: summary.merged_to_main_total,
    by_main_rollup: summary.by_main_rollup,
    by_category: summary.by_category,
    by_year: summary.by_year,
    review_queue: summary.review_queue.slice(0, 20),
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
