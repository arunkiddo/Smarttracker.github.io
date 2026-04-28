import type { Category, Transaction } from "../types";
import { categories } from "../services/categorization";
import { formatCurrency } from "../utils/money";

interface CategoryReviewProps {
  transactions: Transaction[];
  onCorrect: (transaction: Transaction, category: Category) => Promise<void>;
}

export function CategoryReview({ transactions, onCorrect }: CategoryReviewProps) {
  const needsReview = transactions
    .filter((transaction) => transaction.categorySource === "unknown" || transaction.categoryConfidence < 0.6)
    .slice(0, 8);

  if (!needsReview.length) {
    return null;
  }

  return (
    <article className="card review-card">
      <div className="section-title">
        <h2>Review categories</h2>
        <span>{needsReview.length} need input</span>
      </div>
      <div className="review-list">
        {needsReview.map((transaction) => (
          <div className="review-row" key={transaction.id}>
            <div>
              <strong>{transaction.description}</strong>
              <p>{formatCurrency(Math.abs(transaction.amount))}</p>
            </div>
            <select
              aria-label={`Category for ${transaction.description}`}
              defaultValue={transaction.category}
              onChange={(event) => void onCorrect(transaction, event.target.value as Category)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </article>
  );
}
