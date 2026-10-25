// Scores remain stored from Eburum's perspective; only presentation follows home/away order.
const isAwayMatch = match => match.venue === 'Trasferta';
const matchTitle = match => isAwayMatch(match) ? `${match.opponent} – Eburum` : `Eburum – ${match.opponent}`;
const matchScore = match => {
 if (match.goals_for == null || match.goals_against == null) return '– : –';
 return isAwayMatch(match) ? `${match.goals_against} : ${match.goals_for}` : `${match.goals_for} : ${match.goals_against}`;
};
export { isAwayMatch, matchTitle, matchScore };
