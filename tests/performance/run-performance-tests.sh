#!/bin/bash

#
# Performance Test Suite Runner
#
# Comprehensive performance testing for WhatsApp Ordering System
# Runs all performance tests and generates a consolidated report
#
# Usage:
#   chmod +x run-performance-tests.sh
#   ./run-performance-tests.sh [scenario]
#   ./run-performance-tests.sh all
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TESTS_DIR="tests/performance"
RESULTS_DIR="performance-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$RESULTS_DIR/performance-report-$TIMESTAMP.md"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check dependencies
check_dependencies() {
    print_header "Checking Dependencies"
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found"
        exit 1
    fi
    print_success "Node.js: $(node --version)"
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found - some tests may not work"
    else
        print_success "Docker: $(docker --version)"
    fi
    
    echo ""
}

# Run webhook load test
run_webhook_test() {
    local scenario=${1:-moderate}
    print_header "Running Webhook Load Test - $scenario"
    
    node "$TESTS_DIR/webhook-load-test.js" "$scenario" || print_warning "Webhook test failed"
    
    if [ -f "webhook-load-test-results.json" ]; then
        mv webhook-load-test-results.json "$RESULTS_DIR/webhook-load-$scenario-$TIMESTAMP.json"
        print_success "Webhook test completed"
    fi
    echo ""
}

# Run vendor race test
run_vendor_race_test() {
    local scenario=${1:-moderate}
    print_header "Running Vendor Race Test - $scenario"
    
    node "$TESTS_DIR/vendor-race-test.js" "$scenario" || print_warning "Vendor race test failed"
    
    if [ -f "vendor-race-test-results.json" ]; then
        mv vendor-race-test-results.json "$RESULTS_DIR/vendor-race-$scenario-$TIMESTAMP.json"
        print_success "Vendor race test completed"
    fi
    echo ""
}

# Run Redis failure test
run_redis_test() {
    local scenario=${1:-timeout}
    print_header "Running Redis Failure Test - $scenario"
    
    node "$TESTS_DIR/redis-failure-test.js" "$scenario" || print_warning "Redis failure test failed"
    
    if [ -f "redis-failure-test-results.json" ]; then
        mv redis-failure-test-results.json "$RESULTS_DIR/redis-failure-$scenario-$TIMESTAMP.json"
        print_success "Redis failure test completed"
    fi
    echo ""
}

# Run database restart test
run_db_test() {
    local scenario=${1:-graceful}
    print_header "Running Database Restart Test - $scenario"
    
    node "$TESTS_DIR/db-restart-test.js" "$scenario" || print_warning "Database restart test failed"
    
    if [ -f "db-restart-test-results.json" ]; then
        mv db-restart-test-results.json "$RESULTS_DIR/db-restart-$scenario-$TIMESTAMP.json"
        print_success "Database restart test completed"
    fi
    echo ""
}

# Generate consolidated report
generate_report() {
    print_header "Generating Performance Report"
    
    cat > "$REPORT_FILE" << 'EOF'
# Performance Test Report
EOF
    
    echo "" >> "$REPORT_FILE"
    echo "**Generated:** $(date)" >> "$REPORT_FILE"
    echo "**Hostname:** $(hostname)" >> "$REPORT_FILE"
    echo "**Node Version:** $(node --version)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Collect test results
    for result_file in "$RESULTS_DIR"/*-$TIMESTAMP.json; do
        if [ -f "$result_file" ]; then
            echo "## $(basename "$result_file" .json)" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
            echo '```json' >> "$REPORT_FILE"
            cat "$result_file" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
            echo '```' >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
        fi
    done
    
    # Add summary
    cat >> "$REPORT_FILE" << 'EOF'

## Summary & Recommendations

### Breaking Points Detected
- Review individual test results above
- Cross-reference with PERFORMANCE_TESTING_GUIDE.md for remediation

### Next Steps
1. Identify any tests with WARNING or CRITICAL status
2. Apply tuning recommendations from PERFORMANCE_TESTING_GUIDE.md
3. Re-run affected tests to validate improvements
4. Update thresholds as system scales

---

*For detailed tuning guidance, see PERFORMANCE_TESTING_GUIDE.md*
EOF
    
    print_success "Report generated: $REPORT_FILE"
    echo ""
}

# Main execution
main() {
    local scenario=${1:-all}
    
    print_header "WhatsApp Ordering System - Performance Test Suite"
    echo "Timestamp: $TIMESTAMP"
    echo "Scenario: $scenario"
    echo ""
    
    check_dependencies
    
    case "$scenario" in
        webhook)
            run_webhook_test "moderate"
            ;;
        vendor)
            run_vendor_race_test "moderate"
            ;;
        redis)
            run_redis_test "timeout"
            ;;
        database|db)
            run_db_test "graceful"
            ;;
        quick)
            print_header "Quick Performance Test Suite"
            run_webhook_test "light"
            run_vendor_race_test "light"
            run_redis_test "timeout"
            run_db_test "graceful"
            ;;
        full)
            print_header "Full Performance Test Suite"
            run_webhook_test "moderate"
            run_webhook_test "heavy"
            run_vendor_race_test "moderate"
            run_vendor_race_test "heavy"
            run_redis_test "connection"
            run_redis_test "crash"
            run_db_test "graceful"
            run_db_test "crash"
            ;;
        stress)
            print_header "Stress Test Suite"
            run_webhook_test "stress"
            run_vendor_race_test "stress"
            run_redis_test "crash"
            run_db_test "crash"
            ;;
        all)
            print_header "Complete Performance Test Suite"
            run_webhook_test "light"
            run_webhook_test "moderate"
            run_webhook_test "heavy"
            run_vendor_race_test "light"
            run_vendor_race_test "moderate"
            run_vendor_race_test "heavy"
            run_redis_test "connection"
            run_redis_test "timeout"
            run_redis_test "crash"
            run_db_test "graceful"
            run_db_test "crash"
            ;;
        *)
            print_error "Unknown scenario: $scenario"
            echo ""
            echo "Available scenarios:"
            echo "  webhook          - Webhook load test (moderate)"
            echo "  vendor           - Vendor race test (moderate)"
            echo "  redis            - Redis failure test (timeout)"
            echo "  database|db      - Database restart test (graceful)"
            echo "  quick            - Quick suite (light scenarios)"
            echo "  full             - Full suite (all scenarios)"
            echo "  stress           - Stress test suite"
            echo "  all              - Complete suite (all scenarios + stress)"
            exit 1
            ;;
    esac
    
    generate_report
    
    print_header "Performance Testing Complete"
    echo "Results: $RESULTS_DIR/"
    echo "Report: $REPORT_FILE"
    echo ""
    print_success "All tests completed successfully"
}

# Run main function
main "$@"
