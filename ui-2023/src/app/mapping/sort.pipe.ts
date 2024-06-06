import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sort'
})
export class SortPipe implements PipeTransform {

  transform(value: ArrayLike<string>): string[] {
    let array = Array.from(value);
    array.sort((s1, s2) => {
      let n1 = parseInt(s1);
      let n2 = parseInt(s2);
      if (!isNaN(n1) && !isNaN(n2)) {
        return n1 - n2;
      } else {
        return s1.localeCompare(s2);
      }
    });
    return array;
  }
}
