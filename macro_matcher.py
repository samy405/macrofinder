"""
Macro Finder - Matching System

This system matches patient messages to the most relevant macros from the Fountain Workflows document.
It prioritizes usefulness over exact keyword matching.
"""

import json
import re
from typing import List, Dict, Tuple
from dataclasses import dataclass
from difflib import SequenceMatcher


@dataclass
class Macro:
    """Represents a single macro with its title and text."""
    number: int
    title: str
    text: str
    
    def is_title_only(self) -> bool:
        """Check if this is a title-only macro."""
        return self.text.strip() in ["", "[Title only]"]


@dataclass
class MacroMatch:
    """Represents a macro match with its relevance score."""
    macro: Macro
    score: float
    match_reasons: List[str]
    
    def __repr__(self):
        return f"MacroMatch(score={self.score:.3f}, title='{self.macro.title}')"


class MacroMatcher:
    """Matches patient messages to relevant macros."""
    
    def __init__(self, macros: List[Macro]):
        self.macros = macros
        
    def sanitize_message(self, message: str) -> str:
        """Clean and normalize a patient message."""
        # Convert to lowercase
        message = message.lower()
        # Remove extra whitespace
        message = re.sub(r'\s+', ' ', message).strip()
        # Remove common punctuation at the end
        message = re.sub(r'[?.!]+$', '', message)
        return message
    
    def extract_keywords(self, text: str) -> List[str]:
        """Extract meaningful keywords from text."""
        # Remove common stop words
        stop_words = {
            'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
            'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
            'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
            'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
            'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
            'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
            'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
            'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
            'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
            'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
            'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
            'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
        }
        
        # Tokenize and filter
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())
        keywords = [w for w in words if w not in stop_words]
        return keywords
    
    def identify_intent(self, message: str) -> Dict[str, any]:
        """Identify the intent and key topics in the patient message."""
        message_lower = message.lower()
        
        intent = {
            'type': 'general',
            'topics': [],
            'action': None,
            'urgency': 'normal'
        }
        
        # Identify intent type
        if any(word in message_lower for word in ['cancel', 'stop', 'discontinue', 'end']):
            intent['type'] = 'cancellation'
            intent['action'] = 'cancel'
        elif any(word in message_lower for word in ['refund', 'charge', 'bill', 'invoice', 'payment', 'paid', 'cost', 'price']):
            intent['type'] = 'billing'
        elif any(word in message_lower for word in ['lab', 'blood work', 'bloodwork', 'test', 'results']):
            intent['type'] = 'labs'
        elif any(word in message_lower for word in ['order', 'shipment', 'shipping', 'package', 'delivery', 'tracking']):
            intent['type'] = 'orders'
        elif any(word in message_lower for word in ['appointment', 'visit', 'schedule', 'provider', 'doctor', 'consultation']):
            intent['type'] = 'video_visit'
        elif any(word in message_lower for word in ['medication', 'prescription', 'refill', 'dose', 'dosage']):
            intent['type'] = 'medication'
        elif any(word in message_lower for word in ['sign up', 'register', 'start', 'begin', 'join', 'enroll']):
            intent['type'] = 'registration'
        elif any(word in message_lower for word in ['how much', 'pricing', 'cost', 'price', 'expensive']):
            intent['type'] = 'pricing'
        
        # Identify specific topics
        if 'labcorp' in message_lower or 'lab corp' in message_lower:
            intent['topics'].append('labcorp')
        if 'quest' in message_lower:
            intent['topics'].append('quest')
        if 'trt' in message_lower or 'testosterone' in message_lower:
            intent['topics'].append('trt')
        if 'hrt' in message_lower or 'hormone' in message_lower:
            intent['topics'].append('hrt')
        if 'glp' in message_lower or 'weight loss' in message_lower or 'semaglutide' in message_lower:
            intent['topics'].append('glp')
        if 'insurance' in message_lower:
            intent['topics'].append('insurance')
        if 'needle' in message_lower or 'syringe' in message_lower:
            intent['topics'].append('needles')
        
        # Identify urgency
        if any(word in message_lower for word in ['urgent', 'emergency', 'asap', 'immediately', 'now']):
            intent['urgency'] = 'high'
        
        return intent
    
    def calculate_relevance_score(self, patient_message: str, macro: Macro) -> Tuple[float, List[str]]:
        """Calculate how relevant a macro is to the patient message."""
        score = 0.0
        reasons = []
        
        # Sanitize inputs
        message_clean = self.sanitize_message(patient_message)
        title_clean = macro.title.lower()
        text_clean = macro.text.lower() if not macro.is_title_only() else ""
        
        # Get intent and keywords
        intent = self.identify_intent(message_clean)
        message_keywords = set(self.extract_keywords(message_clean))
        title_keywords = set(self.extract_keywords(title_clean))
        text_keywords = set(self.extract_keywords(text_clean)) if text_clean else set()
        
        # 1. Intent matching (highest weight)
        intent_type = intent['type']
        if intent_type != 'general':
            if intent_type in title_clean or intent_type in text_clean:
                score += 3.0
                reasons.append(f"Intent match: {intent_type}")
            
            # Specific intent mappings
            if intent_type == 'cancellation' and any(w in title_clean for w in ['cancel', 'subscription']):
                score += 2.0
                reasons.append("Cancellation intent")
            elif intent_type == 'billing' and any(w in title_clean for w in ['billing', 'payment', 'charge', 'refund']):
                score += 2.0
                reasons.append("Billing intent")
            elif intent_type == 'labs' and any(w in title_clean for w in ['lab', 'labcorp', 'quest', 'blood']):
                score += 2.0
                reasons.append("Labs intent")
            elif intent_type == 'orders' and any(w in title_clean for w in ['order', 'shipping', 'delivery']):
                score += 2.0
                reasons.append("Orders intent")
            elif intent_type == 'video_visit' and any(w in title_clean for w in ['vv', 'visit', 'appointment', 'provider']):
                score += 2.0
                reasons.append("Video visit intent")
            elif intent_type == 'medication' and any(w in title_clean for w in ['medication', 'prescription', 'refill', 'dose']):
                score += 2.0
                reasons.append("Medication intent")
        
        # 2. Topic matching
        for topic in intent['topics']:
            if topic in title_clean or topic in text_clean:
                score += 1.5
                reasons.append(f"Topic: {topic}")
        
        # 3. Keyword overlap in title (high weight)
        title_keyword_overlap = message_keywords.intersection(title_keywords)
        if title_keyword_overlap:
            overlap_score = len(title_keyword_overlap) * 1.0
            score += overlap_score
            reasons.append(f"Title keywords: {', '.join(list(title_keyword_overlap)[:3])}")
        
        # 4. Keyword overlap in text (medium weight)
        if not macro.is_title_only():
            text_keyword_overlap = message_keywords.intersection(text_keywords)
            if text_keyword_overlap:
                overlap_score = len(text_keyword_overlap) * 0.5
                score += overlap_score
                reasons.append(f"Text keywords: {', '.join(list(text_keyword_overlap)[:3])}")
        
        # 5. Sequence similarity (catch semantic similarity)
        title_similarity = SequenceMatcher(None, message_clean, title_clean).ratio()
        if title_similarity > 0.3:
            score += title_similarity * 1.5
            reasons.append(f"Title similarity: {title_similarity:.2f}")
        
        # 6. Direct phrase matching (very high weight)
        # Extract key phrases from message (2-3 word combinations)
        message_words = message_clean.split()
        for i in range(len(message_words) - 1):
            phrase = ' '.join(message_words[i:i+2])
            if len(phrase) > 5 and phrase in title_clean:
                score += 2.5
                reasons.append(f"Direct phrase: '{phrase}'")
            if not macro.is_title_only() and len(phrase) > 5 and phrase in text_clean:
                score += 1.5
                reasons.append(f"Direct phrase in text: '{phrase}'")
        
        # 7. Question type matching
        if '?' in patient_message:
            question_starters = ['how', 'what', 'when', 'where', 'why', 'can', 'do', 'is', 'are']
            for starter in question_starters:
                if message_clean.startswith(starter) and starter in title_clean:
                    score += 0.5
                    reasons.append(f"Question type: {starter}")
        
        # 8. Penalty for title-only macros (should rank lower)
        if macro.is_title_only():
            score *= 0.7
            reasons.append("Title-only macro (reduced score)")
        
        # 9. Boost for common high-value macros that directly answer questions
        if any(phrase in title_clean for phrase in ['how do', 'what is', 'can i', 'do you']):
            score += 0.3
        
        return score, reasons
    
    def find_matches(self, patient_message: str, top_n: int = 3) -> List[MacroMatch]:
        """Find the top N most relevant macros for a patient message."""
        if not patient_message.strip():
            return []
        
        # Calculate scores for all macros
        matches = []
        for macro in self.macros:
            score, reasons = self.calculate_relevance_score(patient_message, macro)
            if score > 0:  # Only include macros with some relevance
                matches.append(MacroMatch(macro=macro, score=score, match_reasons=reasons))
        
        # Sort by score (descending)
        matches.sort(key=lambda x: x.score, reverse=True)
        
        # Return top N, but only if they have a reasonable score
        # Minimum threshold to avoid returning irrelevant macros
        min_score_threshold = 1.0
        relevant_matches = [m for m in matches if m.score >= min_score_threshold]
        
        # Return at most top_n matches
        return relevant_matches[:top_n]


def load_macros_from_markdown(filepath: str) -> List[Macro]:
    """Load macros from the extracted_macros.md file."""
    macros = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse each macro
    pattern = r'## MACRO (\d+)\s*\*\*Title:\*\* ([^\n]+)\s*\*\*Text:\*\* ([^\n]+(?:\n(?!## MACRO)[^\n]+)*)'
    matches = re.finditer(pattern, content, re.MULTILINE)
    
    for match in matches:
        number = int(match.group(1))
        title = match.group(2).strip()
        text = match.group(3).strip()
        
        macros.append(Macro(number=number, title=title, text=text))
    
    return macros


def format_match_result(match: MacroMatch, rank: int) -> str:
    """Format a macro match for display."""
    output = []
    output.append(f"\n{'='*80}")
    output.append(f"RANK #{rank} - Match Score: {match.score:.2f}")
    output.append(f"{'='*80}")
    output.append(f"\nMACRO #{match.macro.number}")
    output.append(f"Title: {match.macro.title}")
    output.append(f"\nMacro Text:")
    output.append("-" * 80)
    if match.macro.is_title_only():
        output.append("[Title only - no text available]")
    else:
        output.append(match.macro.text)
    output.append("-" * 80)
    
    if match.match_reasons:
        output.append(f"\nMatch Reasons:")
        for reason in match.match_reasons:
            output.append(f"  • {reason}")
    
    return '\n'.join(output)


def main():
    """Main function to demonstrate the matching system."""
    # Load macros
    print("Loading macros from extracted_macros.md...")
    macros = load_macros_from_markdown('d:/Cursorprojs/Macrofinder/extracted_macros.md')
    print(f"Loaded {len(macros)} macros\n")
    
    # Create matcher
    matcher = MacroMatcher(macros)
    
    # Example patient messages
    example_messages = [
        "Hello! How can I see my lab results?",
        "I want to cancel my subscription",
        "When will my order ship?",
        "How much does your TRT program cost?",
        "I need to schedule a video visit with my provider",
        "Can you send my prescription to a local pharmacy?",
        "I received a bill from LabCorp, what should I do?",
        "Do you accept insurance?",
    ]
    
    # Test with each example
    for i, message in enumerate(example_messages, 1):
        print(f"\n{'#'*80}")
        print(f"TEST {i}: Patient Message")
        print(f"{'#'*80}")
        print(f"\n\"{message}\"\n")
        
        # Find matches
        matches = matcher.find_matches(message, top_n=3)
        
        if matches:
            print(f"Found {len(matches)} relevant macro(s):")
            for rank, match in enumerate(matches, 1):
                print(format_match_result(match, rank))
        else:
            print("No relevant macros found.")
        
        print("\n")


if __name__ == "__main__":
    main()
