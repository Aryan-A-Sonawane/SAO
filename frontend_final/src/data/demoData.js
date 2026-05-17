/* ─── InterviewVault Demo Mode — Rich Mock Data ──────────────────────────── */

export const DEMO_INTERVIEW_TOPICS = [
    { id: 'dsa', name: 'Data Structures & Algorithms', emoji: '🧠', category: 'Technical' },
    { id: 'sys_design', name: 'System Design', emoji: '🏗️', category: 'Technical' },
    { id: 'os', name: 'Operating Systems', emoji: '⚙️', category: 'Technical' },
    { id: 'dbms', name: 'Database Management', emoji: '🗄️', category: 'Technical' },
    { id: 'cn', name: 'Computer Networks', emoji: '🌐', category: 'Technical' },
    { id: 'ml', name: 'Machine Learning', emoji: '🤖', category: 'Technical' },
    { id: 'python', name: 'Python Programming', emoji: '🐍', category: 'Technical' },
    { id: 'java', name: 'Java Programming', emoji: '☕', category: 'Technical' },
    { id: 'react', name: 'React & Frontend', emoji: '⚛️', category: 'Technical' },
    { id: 'behavioral', name: 'Behavioral Questions', emoji: '🤝', category: 'Soft Skills' },
    { id: 'leadership', name: 'Leadership & Teamwork', emoji: '👥', category: 'Soft Skills' },
    { id: 'problem_solving', name: 'Problem Solving', emoji: '💡', category: 'Soft Skills' },
]

export const DEMO_DAILY_PLAN = {
    greeting: 'Ready to crush your goals today? Let\'s go! 🚀',
    tasks: [
        { title: 'Review Weak Areas', description: 'Revisit your lowest-scoring assessment topics from last week.', type: 'review', duration_min: 15, emoji: '📖' },
        { title: 'DSA Practice', description: 'Solve 3 medium-difficulty problems on arrays and hash maps.', type: 'practice', duration_min: 25, emoji: '✏️' },
        { title: 'Mock Interview', description: 'Do a 5-question behavioral interview session with AI Coach.', type: 'mock_interview', duration_min: 20, emoji: '🎙️' },
        { title: 'System Design Challenge', description: 'Design a URL shortener — focus on scalability and caching.', type: 'challenge', duration_min: 30, emoji: '🏗️' },
    ],
    estimated_total_min: 90,
    focus_area: 'Data Structures & Problem Solving',
    tip: 'Start with the hardest task when your energy is highest. Save reviews for the end of the session.',
}
export const DEMO_USERS = {
    admin: {
        id: 'demo-admin-001',
        name: 'Dr. Priya Sharma',
        email: 'admin@interviewvault.ai',
        role: 'admin',
        avatar_color: '#6366f1',
        xp_points: 0,
        preferred_language: 'en',
    },
    student: {
        id: 'demo-student-001',
        name: 'Arjun Patel',
        email: 'student@interviewvault.ai',
        role: 'student',
        avatar_color: '#a855f7',
        xp_points: 2450,
        preferred_language: 'en',
    },
}

export const DEMO_GAMIFICATION = {
    level: {
        level: 3,
        name: 'Challenger',
        emoji: '🟣',
        xp_current: 2450,
        xp_for_next: 150,
        progress_pct: 71.7,
    },
    badges: [
        { badge_key: 'first_blood', name: 'First Blood', emoji: '🩸', desc: 'Complete your first assessment', xp: 50, earned_at: '2026-01-15T10:00:00' },
        { badge_key: 'streak_3', name: 'On Fire', emoji: '🔥', desc: '3-day study streak', xp: 75, earned_at: '2026-02-01T14:30:00' },
        { badge_key: 'streak_7', name: 'Unstoppable', emoji: '⚡', desc: '7-day study streak', xp: 150, earned_at: '2026-02-08T09:15:00' },
        { badge_key: 'five_star', name: 'Five Star', emoji: '⭐', desc: 'Complete 5 assessments', xp: 100, earned_at: '2026-02-20T16:45:00' },
        { badge_key: 'speed_demon', name: 'Speed Demon', emoji: '🏎️', desc: 'Finish under 50% of time limit', xp: 100, earned_at: '2026-03-01T11:20:00' },
    ],
    total_badges: 5,
    available_badges: 11,
    streak_days: 7,
    xp_points: 2450,
}

export const DEMO_LEADERBOARD = {
    entries: [
        { rank: 1, user_id: 'lb-1', name: 'Sneha Kulkarni', avatar_color: '#10b981', xp_points: 4200, level: 5, level_name: 'Master', level_emoji: '🔴', badge_count: 8, streak_days: 21 },
        { rank: 2, user_id: 'lb-2', name: 'Rahul Mehta', avatar_color: '#06b6d4', xp_points: 3800, level: 5, level_name: 'Master', level_emoji: '🔴', badge_count: 7, streak_days: 14 },
        { rank: 3, user_id: 'lb-3', name: 'Ananya Singh', avatar_color: '#f59e0b', xp_points: 3100, level: 4, level_name: 'Expert', level_emoji: '🟠', badge_count: 6, streak_days: 10 },
        { rank: 4, user_id: 'demo-student-001', name: 'Arjun Patel', avatar_color: '#a855f7', xp_points: 2450, level: 3, level_name: 'Challenger', level_emoji: '🟣', badge_count: 5, streak_days: 7 },
        { rank: 5, user_id: 'lb-5', name: 'Deepak Sharma', avatar_color: '#ef4444', xp_points: 2100, level: 3, level_name: 'Challenger', level_emoji: '🟣', badge_count: 4, streak_days: 5 },
        { rank: 6, user_id: 'lb-6', name: 'Meera Joshi', avatar_color: '#8b5cf6', xp_points: 1800, level: 3, level_name: 'Challenger', level_emoji: '🟣', badge_count: 4, streak_days: 3 },
        { rank: 7, user_id: 'lb-7', name: 'Kiran Patel', avatar_color: '#22c55e', xp_points: 1200, level: 2, level_name: 'Apprentice', level_emoji: '🔵', badge_count: 3, streak_days: 2 },
        { rank: 8, user_id: 'lb-8', name: 'Aisha Khan', avatar_color: '#3b82f6', xp_points: 950, level: 2, level_name: 'Apprentice', level_emoji: '🔵', badge_count: 2, streak_days: 1 },
    ],
    my_rank: 4,
    my_xp: 2450,
}

export const DEMO_ADMIN_OVERVIEW = {
    total_users: 247,
    total_assessments: 34,
    total_submissions: 1893,
}

export const DEMO_STUDENT_ANALYTICS = {
    total_submissions: 12,
    average_score: 78,
    best_score: 95,
    xp_points: 2450,
    streak_days: 7,
    skill_radar: {
        labels: ['Critical Thinking', 'Application', 'Analysis', 'Problem Solving', 'Creativity', 'Technical Depth'],
        scores: [82, 75, 88, 71, 65, 90],
    },
    score_history: [
        { date: 'Jan', score: 62 },
        { date: 'Feb', score: 71 },
        { date: 'Mar', score: 68 },
        { date: 'Apr', score: 78 },
        { date: 'May', score: 85 },
        { date: 'Jun', score: 82 },
        { date: 'Jul', score: 95 },
    ],
    pathway_steps: [
        {
            reason: 'Based on your assessment patterns, strengthening "Application" skills through hands-on coding challenges will boost your overall performance by ~15%.',
            skill_gaps: ['Practical Application', 'Code Optimization'],
        },
        {
            reason: 'Your "Creativity" scores are rising — try the advanced open-ended assessments to push past 80%.',
            skill_gaps: ['Creative Problem Solving'],
        },
    ],
    peer_percentile: 82,
    success_prediction: 76,
}

export const DEMO_ASSESSMENTS = [
    {
        id: 'demo-assess-1',
        title: 'Data Structures & Algorithms — AI Assessment',
        description: 'Auto-generated higher-order assessment covering trees, graphs, dynamic programming, and time complexity analysis. Tests real problem-solving ability.',
        difficulty: 'advanced',
        num_questions: 8,
        time_limit_minutes: 45,
        thumbnail_emoji: '🧠',
        submission_count: 156,
        category: 'Computer Science',
        user_submitted: false,
        tags: ['algorithms', 'ai-generated', 'advanced'],
    },
    {
        id: 'demo-assess-2',
        title: 'Operating Systems Internals — AI Assessment',
        description: 'Deep-dive into process scheduling, memory management, and concurrency. Bloom\'s Taxonomy questions from Remember to Create.',
        difficulty: 'intermediate',
        num_questions: 7,
        time_limit_minutes: 35,
        thumbnail_emoji: '⚙️',
        submission_count: 89,
        category: 'Computer Science',
        user_submitted: true,
        tags: ['os', 'ai-generated', 'intermediate'],
    },
    {
        id: 'demo-assess-3',
        title: 'Machine Learning Fundamentals — AI Assessment',
        description: 'Covers supervised/unsupervised learning, neural networks, gradient descent, and model evaluation metrics.',
        difficulty: 'intermediate',
        num_questions: 6,
        time_limit_minutes: 30,
        thumbnail_emoji: '🤖',
        submission_count: 203,
        category: 'AI/ML',
        user_submitted: false,
        tags: ['ml', 'ai-generated', 'intermediate'],
    },
    {
        id: 'demo-assess-4',
        title: 'Computer Networks — AI Assessment',
        description: 'TCP/IP stack, routing algorithms, DNS resolution, and network security protocols. Applied scenario questions.',
        difficulty: 'beginner',
        num_questions: 5,
        time_limit_minutes: 25,
        thumbnail_emoji: '🌐',
        submission_count: 67,
        category: 'Networking',
        user_submitted: false,
        tags: ['networks', 'ai-generated', 'beginner'],
    },
]

export const DEMO_CLASSROOMS = [
    {
        id: 'demo-class-1',
        name: 'Network Engineering — Sem 5',
        description: 'TCP/IP, routing, and network security fundamentals',
        class_code: 'NE5K2A',
        student_count: 42,
        assessment_count: 8,
        created_at: '2026-01-15',
    },
    {
        id: 'demo-class-2',
        name: 'Data Science Lab — Section B',
        description: 'Python, pandas, ML pipelines, and statistical analysis',
        class_code: 'DSL4B7',
        student_count: 35,
        assessment_count: 12,
        created_at: '2026-02-01',
    },
]

/* ─── Demo PDF Assessment — Bloom's Taxonomy Questions ───────────────── */
export const DEMO_PDF_RESULT = {
    pdf: {
        id: 'demo-pdf-001',
        original_filename: 'Advanced_Data_Structures.pdf',
        num_pages: 24,
        language: 'en',
        file_size_kb: 2048,
        key_terms: ['Binary Search Tree', 'AVL Tree', 'Red-Black Tree', 'B-Tree', 'Hash Table', 'Graph Traversal', 'Dynamic Programming', 'Amortized Analysis'],
    },
    assessment: {
        id: 'demo-assess-generated',
        title: 'Advanced Data Structures — AI Assessment',
        num_questions: 7,
        difficulty: 'advanced',
        language: 'en',
    },
    message: 'Successfully generated 7 topic-specific questions from 24 pages!',
}

export const DEMO_GENERATED_ASSESSMENT = {
    id: 'demo-assess-generated',
    title: 'Advanced Data Structures — AI Assessment',
    description: 'Auto-generated higher-order assessment from Advanced_Data_Structures.pdf. 24 pages analyzed. Key topics: Binary Search Tree, AVL Tree, Red-Black Tree, B-Tree, Hash Table.',
    difficulty: 'advanced',
    num_questions: 7,
    time_limit_minutes: 40,
    thumbnail_emoji: '🌳',
    submission_count: 0,
    category: 'PDF Upload',
    user_submitted: false,
    tags: ['pdf', 'ai-generated', 'advanced', 'Binary Search Tree', 'AVL Tree'],
}

/* ─── Demo Coding Challenge ──────────────────────────────────────────── */
export const DEMO_CODING_CHALLENGE = {
    title: 'Two Sum',
    difficulty: 'Medium',
    category: 'Arrays & Hashing',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers* such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\`

**Constraints:**
- 2 ≤ nums.length ≤ 10⁴
- -10⁹ ≤ nums[i] ≤ 10⁹
- -10⁹ ≤ target ≤ 10⁹
- Only one valid answer exists.`,
    boilerplate: `def two_sum(nums, target):
    """
    Find two indices whose values sum to target.
    
    Args:
        nums: List of integers
        target: Target sum
    Returns:
        List of two indices
    """
    # Your solution here
    pass
`,
    testCases: [
        { input: 'nums = [2,7,11,15], target = 9', expected: '[0, 1]', passed: true },
        { input: 'nums = [3,2,4], target = 6', expected: '[1, 2]', passed: true },
        { input: 'nums = [3,3], target = 6', expected: '[0, 1]', passed: true },
        { input: 'nums = [-1,-2,-3,-4,-5], target = -8', expected: '[2, 4]', passed: true },
        { input: 'nums = [1000000,500000,-1500000], target = -1000000', expected: '[1, 2]', passed: true },
    ],
    sampleSolution: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`,
}

export const DEMO_AI_EVALUATION = {
    overall_score: 87,
    verdict: 'Excellent',
    time_complexity: {
        score: 95,
        analysis: 'O(n) — Optimal. Uses a hash map for constant-time lookups, avoiding the O(n²) brute-force approach.',
        label: 'Optimal',
    },
    space_complexity: {
        score: 85,
        analysis: 'O(n) — Linear auxiliary space for the hash map. This is the expected trade-off for optimal time complexity.',
        label: 'Expected Trade-off',
    },
    correctness: {
        score: 100,
        analysis: 'All 5 test cases passed including edge cases with negative numbers and large values.',
        tests_passed: 5,
        tests_total: 5,
    },
    code_quality: {
        score: 78,
        analysis: 'Clean and readable code. Consider adding input validation and using more descriptive variable names (e.g., `complement_map` instead of `seen`).',
        suggestions: [
            'Add type hints: `def two_sum(nums: list[int], target: int) -> list[int]:`',
            'Consider raising ValueError for invalid inputs',
            'Variable `seen` could be more descriptive — try `index_map`',
        ],
    },
    bloom_level: 'Apply',
    feedback: 'Your solution demonstrates strong algorithmic thinking. The hash map approach shows you understand the time-space trade-off. The code is clean and Pythonic. To reach the "Analyze" level, try explaining WHY the hash map approach works and when it might not be optimal (e.g., when space is constrained).',
}
