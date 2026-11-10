#!/usr/bin/env python3
"""Independent register/decimal-loop transcription of AMCAF R0b1/R0b2.
Recovered native source, not native execution; no production JS imports.
"""
import json

def format_decimal(value,width,zero):
    negative=value<0
    remaining=value
    out=[]
    divisors=[10**i for i in range(width-1,-1,-1)]
    if zero and negative:
        out.append('-')
        if width==1:return '-'
        remaining=(-value+2**31)%2**32-2**31
        if remaining>=divisors[0]:return '-'+'9'*(width-1)
        divisors.pop(0)
    elif negative:
        remaining=(-value+2**31)%2**32-2**31
        if remaining>=divisors[0]:return '-'+'9'*(width-1)
    started=False
    for divisor in divisors:
        digit=0
        while remaining>=divisor and digit<10:
            remaining-=divisor;digit+=1
        if digit==10:return ''.join(out)+'9'*(width-len(out))
        if digit:
            if not zero and negative and not started and out:out[-1]='-'
            started=True
        out.append(str(digit) if zero or started or divisor==1 else ' ')
    return ''.join(out)

if __name__=='__main__':
    values=[-2147483648,-2147483647,-1000000000,-1000,-999,-100,-99,-10,-9,-1,0,1,9,10,99,100,999,1000,1000000000,2147483647]
    print(json.dumps({'evidence':'Independent decimal-loop transcription of AMCAF R0b1/R0b2; not native capture.',
      'decimal':[[v,w,format_decimal(v,w,False),format_decimal(v,w,True)] for v in values for w in range(1,11)]},indent=2))
